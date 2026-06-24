import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }
const BASE_ENV = {
  ...OLD_ENV,
  NODE_ENV: 'test',
  API_URL: 'https://api.example.test',
  TOKEN_ENDPOINT: 'token',
  API_USERNAME: 'user',
  API_PASSWORD: 'password',
  PANEL_LIDER_ENDPOINT: 'lider-endpoint',
  PANEL_GENERAL_ENDPOINT: 'general-endpoint',
  PANEL_CEDEARS_ENDPOINT: 'cedears-endpoint',
} satisfies NodeJS.ProcessEnv

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init)
}

async function loadRoutes(
  iolFetch: ReturnType<typeof vi.fn>,
  envOverrides: Record<string, string | undefined> = {}
) {
  vi.resetModules()
  process.env = {
    ...BASE_ENV,
    ...envOverrides,
  }
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/upstream/iol', () => ({ iolFetch }))

  const [{ GET: panelGet, clearPanelCacheForTests }, { GET: historyGet }, { GET: metricsGet }, observability, historyCache] =
    await Promise.all([
      import('@/app/api/panel/route'),
      import('@/app/api/stocks/[symbol]/history/route'),
      import('./route'),
      import('@/lib/server/core/observability'),
      import('@/lib/server/history/historyCache'),
    ])

  observability.clearObservabilityStateForTests()
  clearPanelCacheForTests()
  historyCache.clearHistoryCacheForTests()

  return {
    historyGet,
    metricsGet,
    panelGet,
  }
}

describe('/api/debug/metrics route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T15:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('is disabled by default in production without a token', async () => {
    const { metricsGet } = await loadRoutes(vi.fn(), {
      MARKET_DATA_SOURCE: 'demo',
      NODE_ENV: 'production',
      OBSERVABILITY_DEBUG_TOKEN: undefined,
    })

    const response = await metricsGet(request('/api/debug/metrics'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({
      ok: false,
      error: 'NOT_FOUND',
      requestId: expect.any(String),
    })
    expect(body).not.toHaveProperty('metrics')
  })

  it('rejects invalid tokens in production without revealing metrics', async () => {
    const { metricsGet } = await loadRoutes(vi.fn(), {
      MARKET_DATA_SOURCE: 'demo',
      NODE_ENV: 'production',
      OBSERVABILITY_DEBUG_TOKEN: 'metrics-secret',
    })

    const response = await metricsGet(
      request('/api/debug/metrics', {
        headers: { 'x-observability-token': 'wrong-token' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
      requestId: expect.any(String),
    })
    expect(JSON.stringify(body)).not.toContain('metrics-secret')
    expect(body).not.toHaveProperty('metrics')
  })

  it('returns aggregated metrics with a valid production token', async () => {
    const iolFetch = vi.fn(async (path: string) => {
      if (path.includes('seriehistorica')) {
        return [{ fecha: '2026-05-07', ultimoPrecio: 101 }]
      }

      return [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }]
    })
    const { panelGet, historyGet, metricsGet } = await loadRoutes(iolFetch, {
      MARKET_DATA_SOURCE: 'live',
      NODE_ENV: 'production',
      OBSERVABILITY_DEBUG_TOKEN: 'metrics-secret',
      RATE_LIMIT_TRUSTED_PROXY: 'vercel',
      VERCEL: '1',
    })

    await panelGet(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )
    await panelGet(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )
    await historyGet(
      request('/api/stocks/GGAL/history?range=1W&market=bCBA', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      }),
      { params: Promise.resolve({ symbol: 'GGAL' }) }
    )
    await historyGet(
      request('/api/stocks/GGAL/history?range=1W&market=bCBA', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      }),
      { params: Promise.resolve({ symbol: 'GGAL' }) }
    )

    const response = await metricsGet(
      request('/api/debug/metrics', {
        headers: { 'x-observability-token': 'metrics-secret' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      dataSource: 'live',
      metrics: {
        processLocal: true,
      },
      runtime: {
        processLocal: true,
        panelCache: {
          entries: 1,
        },
        historyCache: {
          entries: 1,
        },
      },
    })

    expect(body.metrics.counters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api.request.total',
          tags: expect.objectContaining({
            endpoint: '/api/panel',
            outcome: 'success',
            status: '200',
          }),
        }),
        expect.objectContaining({
          name: 'panel.cache.event.total',
          tags: expect.objectContaining({
            event: 'hit',
            panelType: 'lider',
          }),
        }),
        expect.objectContaining({
          name: 'history.cache.event.total',
          tags: expect.objectContaining({
            event: 'hit',
            market: 'bCBA',
            range: '1W',
          }),
        }),
        expect.objectContaining({
          name: 'rate_limit.check.total',
          tags: expect.objectContaining({
            namespace: 'panel',
            outcome: 'allowed',
          }),
        }),
        expect.objectContaining({
          name: 'rate_limit.check.total',
          tags: expect.objectContaining({
            namespace: 'history',
            outcome: 'allowed',
          }),
        }),
      ])
    )
    expect(body.metrics.timings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api.request.duration_ms',
        }),
        expect.objectContaining({
          name: 'api.request.duration_ms',
          tags: expect.objectContaining({
            endpoint: '/api/stocks/[symbol]/history',
          }),
        }),
      ])
    )
  })
})
