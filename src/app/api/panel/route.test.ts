import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }
const LIVE_ENV_DEFAULTS = {
  MARKET_DATA_SOURCE: 'live',
  API_URL: 'https://api.example.test',
  TOKEN_ENDPOINT: 'token',
  API_USERNAME: 'user',
  API_PASSWORD: 'password',
  PANEL_LIDER_ENDPOINT: 'lider-endpoint',
  PANEL_GENERAL_ENDPOINT: 'general-endpoint',
  PANEL_CEDEARS_ENDPOINT: 'cedears-endpoint',
} satisfies Record<string, string>

function setRequiredEnv(
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test',
  overrides: Record<string, string | undefined> = {}
) {
  process.env = {
    ...OLD_ENV,
    ...LIVE_ENV_DEFAULTS,
    ...overrides,
    NODE_ENV: nodeEnv,
  }
}

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init)
}

function remoteRequest(path: string) {
  return new NextRequest(`https://preview.example.test${path}`)
}

function expectPanelSuccess(
  body: unknown,
  data: unknown[],
  cacheStatus: 'fresh' | 'memory-cache' = 'fresh'
) {
  expect(body).toEqual({
    ok: true,
    data,
    fetchedAt: expect.any(String),
    servedAt: expect.any(String),
    cacheStatus,
  })
}

function expectRequestIdHeader(response: Response, expected?: string) {
  const requestId = response.headers.get('X-Request-Id')

  if (expected) {
    expect(requestId).toBe(expected)
    return
  }

  expect(requestId).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
}

async function loadLiveRoute(
  iolFetch: ReturnType<typeof vi.fn>,
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test',
  envOverrides: Record<string, string | undefined> = {}
) {
  vi.resetModules()
  setRequiredEnv(nodeEnv, {
    MARKET_DATA_SOURCE: 'live',
    ...envOverrides,
  })
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  return import('./route')
}

async function loadDemoRoute(
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test',
  envOverrides: Record<string, string | undefined> = {}
) {
  vi.resetModules()
  process.env = {
    ...OLD_ENV,
    NODE_ENV: nodeEnv,
    MARKET_DATA_SOURCE: 'demo',
    ...envOverrides,
  }
  const iolFetch = vi.fn(() => {
    throw new Error('live upstream should not be used in demo mode')
  })
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  const route = await import('./route')

  return {
    ...route,
    iolFetch,
  }
}

async function loadRouteWithoutRequiredEnv(iolFetch: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  process.env = {
    ...OLD_ENV,
    NODE_ENV: 'test',
    MARKET_DATA_SOURCE: 'live',
    API_URL: undefined,
    TOKEN_ENDPOINT: undefined,
    API_USERNAME: undefined,
    API_PASSWORD: undefined,
    PANEL_LIDER_ENDPOINT: undefined,
    PANEL_GENERAL_ENDPOINT: undefined,
    PANEL_CEDEARS_ENDPOINT: undefined,
  }
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  return import('./route')
}

async function clearPanelTestState() {
  try {
    const [
      { clearPanelResponseCacheForTests },
      { clearPanelLimitsForTests },
      { clearObservabilityStateForTests },
    ] = await Promise.all([
      import('@/lib/server/panelCache'),
      import('@/lib/server/panelLimits'),
      import('@/lib/server/observability'),
    ])

    clearPanelResponseCacheForTests()
    clearPanelLimitsForTests()
    clearObservabilityStateForTests()
  } catch {
    // Ignore cleanup before the first import of the server modules.
  }
}

describe('/api/panel route', () => {
  beforeEach(async () => {
    await clearPanelTestState()
    vi.clearAllMocks()
    setRequiredEnv()
  })

  afterEach(async () => {
    await clearPanelTestState()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = { ...OLD_ENV }
  })

  it('returns 400 when the panel type is invalid', async () => {
    const iolFetch = vi.fn()
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=invalid'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      ok: false,
      error: 'INVALID_PANEL_TYPE',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expectRequestIdHeader(response, body.requestId)
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('falls back to lider when the panel type is omitted', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    expect(iolFetch).toHaveBeenCalledWith('lider-endpoint')
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('normalizes valid upstream responses', async () => {
    const iolFetch = vi.fn().mockResolvedValue({
      titulos: [
        {
          simbolo: 'YPFD',
          descripcion: 'YPF',
          ultimoPrecio: 100,
        },
      ],
    })
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=general'))
    const body = await response.json()

    expectPanelSuccess(body, [
      { simbolo: 'YPFD', descripcion: 'YPF', ultimoPrecio: 100 },
    ])
    expect(iolFetch).toHaveBeenCalledWith('general-endpoint')
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('uses the cedears endpoint for type=cedears', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'AAPL', descripcion: 'Apple' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=cedears'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [{ simbolo: 'AAPL', descripcion: 'Apple' }])
    expect(iolFetch).toHaveBeenCalledWith('cedears-endpoint')
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('returns 400 for the UI-only favorites panel type', async () => {
    const iolFetch = vi.fn()
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=favorites'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      ok: false,
      error: 'INVALID_PANEL_TYPE',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('returns an empty data array for an empty upstream payload', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ data: [] })
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [])
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('returns PANEL_ERROR with status 502 for invalid upstream payloads', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ items: [] })
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toMatchObject({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'Invalid upstream payload structure',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('returns partial valid panel data when the upstream payload is partially invalid', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
      { simbolo: '', descripcion: 'Missing ticker' },
    ])
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(1)
    expect(consoleWarn).toHaveBeenCalledWith(
      '[panel.normalize.partial]',
      expect.objectContaining({
        level: 'warn',
        panelType: 'lider',
        droppedItemsCount: 1,
        droppedItemsSummary: ['INVALID_IDENTITY:1'],
      })
    )
  })

  it('uses cache for a second request to the same panel', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'ALUA', descripcion: 'Aluar' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=cedears'))
    const response = await GET(request('/api/panel?type=cedears'))
    const body = await response.json()

    expectPanelSuccess(
      body,
      [{ simbolo: 'ALUA', descripcion: 'Aluar' }],
      'memory-cache'
    )
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('bypasses the memory cache when refresh=1 is requested', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    const response = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await response.json()

    expectPanelSuccess(body, [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('allows the first manual refresh for a panel and client key', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.30' },
      })
    )

    const response = await GET(
      request('/api/panel?type=lider&refresh=1', {
        headers: { 'x-forwarded-for': '203.0.113.30' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('blocks repeated manual refreshes during the cooldown window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    await GET(request('/api/panel?type=lider&refresh=1'))

    const response = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(body).toMatchObject({
      ok: false,
      error: 'REFRESH_COOLDOWN',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('serves stale cache and keeps manual refresh in cooldown after an upstream refresh failure', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockRejectedValueOnce(new Error('upstream failed'))
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))

    const staleRefresh = await GET(request('/api/panel?type=lider&refresh=1'))

    expect(staleRefresh.status).toBe(200)
    expectPanelSuccess(
      await staleRefresh.json(),
      [{ simbolo: 'ALUA', descripcion: 'Aluar' }],
      'memory-cache'
    )

    const blockedRefresh = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await blockedRefresh.json()

    expect(blockedRefresh.status).toBe(429)
    expect(blockedRefresh.headers.get('Retry-After')).toBe('15')
    expect(body).toMatchObject({
      ok: false,
      error: 'REFRESH_COOLDOWN',
    })
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('returns stale panel cache when upstream fails after cache expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockRejectedValueOnce(new Error('upstream failed'))
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    vi.setSystemTime(new Date('2026-05-04T16:00:31.000Z'))

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(
      body,
      [{ simbolo: 'ALUA', descripcion: 'Aluar' }],
      'memory-cache'
    )
    expect(iolFetch).toHaveBeenCalledTimes(2)
    expect(consoleWarn).toHaveBeenCalledWith(
      '[panel.cache.stale-fallback]',
      expect.objectContaining({
        level: 'warn',
        panelType: 'lider',
        reason: 'upstream failed',
      })
    )
  })

  it('keeps normal cache reads working while manual refresh is in cooldown', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    await GET(request('/api/panel?type=lider&refresh=1'))

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(
      body,
      [{ simbolo: 'COME', descripcion: 'Comercial del Plata' }],
      'memory-cache'
    )
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('allows manual refresh again after the cooldown window expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
      .mockResolvedValueOnce([{ simbolo: 'PAMP', descripcion: 'Pampa Energia' }])
    const { GET } = await loadLiveRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    await GET(request('/api/panel?type=lider&refresh=1'))

    vi.setSystemTime(new Date('2026-05-04T16:00:16.000Z'))

    const response = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'PAMP', descripcion: 'Pampa Energia' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(3)
  })

  it('deduplicates concurrent requests to the same uncached panel', async () => {
    let resolvePanel!: (value: unknown) => void
    const iolFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePanel = resolve
        })
    )
    const { GET } = await loadLiveRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider'))
    const second = GET(request('/api/panel?type=lider'))
    await vi.waitFor(() => {
      expect(iolFetch).toHaveBeenCalledTimes(1)
    })

    resolvePanel([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])

    const [firstResponse, secondResponse] = await Promise.all([first, second])

    expectPanelSuccess(await firstResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expectPanelSuccess(await secondResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('throttles a concurrent manual refresh for the same client and panel', async () => {
    let resolvePanel!: (value: unknown) => void
    const iolFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePanel = resolve
        })
    )
    const { GET } = await loadLiveRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider&refresh=1'))
    const second = GET(request('/api/panel?type=lider&refresh=1'))
    await vi.waitFor(() => {
      expect(iolFetch).toHaveBeenCalledTimes(1)
    })

    resolvePanel([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])

    const [firstResponse, secondResponse] = await Promise.all([first, second])

    expectPanelSuccess(await firstResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(secondResponse.status).toBe(429)
    expect(await secondResponse.json()).toMatchObject({
      ok: false,
      error: 'REFRESH_COOLDOWN',
    })
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps simultaneous refresh and normal requests successful', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadLiveRoute(iolFetch)

    const [refreshResponse, normalResponse] = await Promise.all([
      GET(request('/api/panel?type=lider&refresh=1')),
      GET(request('/api/panel?type=lider')),
    ])

    expectPanelSuccess(await refreshResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expectPanelSuccess(await normalResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('clearPanelCacheForTests clears cached responses and in-flight requests', async () => {
    let resolveFirst!: (value: unknown) => void
    let resolveSecond!: (value: unknown) => void
    const iolFetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          })
      )
      .mockResolvedValue([{ simbolo: 'PAMP', descripcion: 'Pampa Energia' }])
    const { GET, clearPanelCacheForTests } = await loadLiveRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider'))
    await vi.waitFor(() => {
      expect(iolFetch).toHaveBeenCalledTimes(1)
    })

    clearPanelCacheForTests()

    const second = GET(request('/api/panel?type=lider'))
    await vi.waitFor(() => {
      expect(iolFetch).toHaveBeenCalledTimes(2)
    })

    resolveFirst([{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }])
    resolveSecond([{ simbolo: 'YPFD', descripcion: 'YPF' }])

    expectPanelSuccess(await first.then((response) => response.json()), [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    expectPanelSuccess(await second.then((response) => response.json()), [
      { simbolo: 'YPFD', descripcion: 'YPF' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(2)

    const third = await GET(request('/api/panel?type=lider'))

    expectPanelSuccess(
      await third.json(),
      [{ simbolo: 'YPFD', descripcion: 'YPF' }],
      'memory-cache'
    )
    expect(iolFetch).toHaveBeenCalledTimes(2)

    clearPanelCacheForTests()

    const fourth = await GET(request('/api/panel?type=lider'))

    expectPanelSuccess(await fourth.json(), [
      { simbolo: 'PAMP', descripcion: 'Pampa Energia' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(3)
  })

  it('returns PANEL_ERROR with status 502 for upstream errors', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('upstream failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { GET } = await loadLiveRoute(iolFetch, 'test', {
      RATE_LIMIT_TRUSTED_PROXY: 'vercel',
      VERCEL: '1',
    })

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toMatchObject({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'upstream failed',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      '[api.panel.GET]',
      expect.objectContaining({
        level: 'error',
        requestId: body.requestId,
        route: '/api/panel',
        panelType: 'lider',
        bypassCache: false,
        shouldReturnRaw: false,
        error: expect.objectContaining({
          message: 'upstream failed',
        }),
      })
    )
  })

  it('sets no-store cache headers for panel responses', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expectRequestIdHeader(response)
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('does not expose raw upstream payloads from non-local debug requests', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      {
        simbolo: 'GGAL',
        descripcion: 'Grupo Financiero Galicia',
        rawOnly: 'hidden',
      },
    ])
    const { GET } = await loadLiveRoute(iolFetch, 'development')
    process.env.ENABLE_TOKEN_DEBUG = '1'

    const response = await GET(remoteRequest('/api/panel?type=lider&raw=1'))
    const body = await response.json()

    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('allows raw upstream payloads only for local debug requests', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ upstream: true })
    const { GET } = await loadLiveRoute(iolFetch, 'development')
    process.env.ENABLE_TOKEN_DEBUG = '1'

    const response = await GET(request('/api/panel?type=lider&raw=1'))
    const body = await response.json()

    expect(body).toEqual({
      ok: true,
      type: 'lider',
      data: { upstream: true },
    })
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('rate limits repeated requests from the same client', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch, 'test', {
      RATE_LIMIT_TRUSTED_PROXY: 'vercel',
      VERCEL: '1',
    })
    let response = await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )

    for (let index = 1; index < 121; index += 1) {
      response = await GET(
        request('/api/panel?type=lider', {
          headers: { 'x-forwarded-for': '203.0.113.10' },
        })
      )
    }

    const body = await response.json()

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1)
    expect(Number(response.headers.get('Retry-After'))).toBeLessThanOrEqual(60)
    expect(body).toMatchObject({
      ok: false,
      error: 'RATE_LIMITED',
    })
    expect(body.requestId).toEqual(expect.any(String))
  })

  it('returns 503 JSON when the rate limit store is unavailable', async () => {
    const iolFetch = vi.fn()
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new Error(
          'redis failed for https://kv.internal.example.test using RATE_LIMIT_REDIS_REST_TOKEN-secret'
        )
      )
    )
    const { GET } = await loadLiveRoute(iolFetch, 'production', {
      RATE_LIMIT_STORE: 'redis-rest',
      RATE_LIMIT_REDIS_REST_URL: 'https://kv.internal.example.test',
      RATE_LIMIT_REDIS_REST_TOKEN: 'RATE_LIMIT_REDIS_REST_TOKEN-secret',
    })

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(body).toEqual({
      ok: false,
      error: 'RATE_LIMIT_UNAVAILABLE',
      requestId: expect.any(String),
    })
    expectRequestIdHeader(response, body.requestId)
    expect(iolFetch).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
      'https://kv.internal.example.test'
    )
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
      'RATE_LIMIT_REDIS_REST_TOKEN-secret'
    )
  })

  it('prunes expired rate limit entries before counting a new window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch, 'test', {
      RATE_LIMIT_TRUSTED_PROXY: 'vercel',
      VERCEL: '1',
    })

    for (let index = 0; index < 120; index += 1) {
      await GET(
        request('/api/panel?type=lider', {
          headers: { 'x-forwarded-for': '203.0.113.20' },
        })
      )
    }

    vi.setSystemTime(new Date('2026-05-04T16:01:01.000Z'))

    const response = await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.20' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
  })

  it('returns a controlled error when required env vars are missing', async () => {
    const iolFetch = vi.fn()
    const { GET } = await loadRouteWithoutRequiredEnv(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toMatchObject({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'Missing PANEL_LIDER_ENDPOINT',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('can be imported without required env vars during build-time analysis', async () => {
    const iolFetch = vi.fn()

    await expect(loadRouteWithoutRequiredEnv(iolFetch)).resolves.toMatchObject({
      dynamic: 'force-dynamic',
      runtime: 'nodejs',
    })
  })

  it('serves deterministic demo panel data without live credentials', async () => {
    const { GET, iolFetch } = await loadDemoRoute()

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      cacheStatus: 'fresh',
      data: expect.arrayContaining([
        expect.objectContaining({
          simbolo: 'GGAL',
          descripcion: 'Grupo Financiero Galicia',
        }),
      ]),
    })
    expect(response.headers.get('X-RateLimit-Limit')).toBe('120')
    expect(response.headers.get('X-Request-Id')).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('does not expose error details in production', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('secret upstream detail'))
    const { GET } = await loadLiveRoute(iolFetch, 'production')

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toMatchObject({
      ok: false,
      error: 'PANEL_ERROR',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('exposes error details outside production', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('development detail'))
    const { GET } = await loadLiveRoute(iolFetch, 'development')

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toMatchObject({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'development detail',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('returns 405 and Allow GET for POST requests', async () => {
    const iolFetch = vi.fn()
    const { POST } = await loadLiveRoute(iolFetch)

    const response = POST(request('/api/panel'))
    const body = await response.json()

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
    expect(body).toMatchObject({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    })
    expect(body.requestId).toEqual(expect.any(String))
    expectRequestIdHeader(response, body.requestId)
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('does not trust spoofed forwarded IP headers when proxy trust is disabled', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    let response = await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )

    for (let index = 1; index < 121; index += 1) {
      response = await GET(
        request('/api/panel?type=lider', {
          headers: { 'x-forwarded-for': `203.0.113.${index}` },
        })
      )
    }

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1)
    expect(Number(response.headers.get('Retry-After'))).toBeLessThanOrEqual(60)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('120')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('returns rate limit headers on successful panel responses', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('120')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('119')
    expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/)
    expectRequestIdHeader(response)
    expect(iolFetch).toHaveBeenCalledTimes(1)
  })

  it('propagates a valid x-request-id and discards an invalid one', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadLiveRoute(iolFetch)

    const propagated = await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-request-id': 'req-12345678' },
      })
    )
    const regenerated = await GET(
      request('/api/panel?type=lider', {
        headers: { 'x-request-id': 'bad id' },
      })
    )

    expect(propagated.headers.get('X-Request-Id')).toBe('req-12345678')
    expect(regenerated.headers.get('X-Request-Id')).not.toBe('bad id')
    expect(regenerated.headers.get('X-Request-Id')).toMatch(
      /^[A-Za-z0-9._:-]{8,128}$/
    )
  })
})
