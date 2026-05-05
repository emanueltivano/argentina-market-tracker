import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env

function setRequiredEnv(nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test') {
  process.env = {
    ...OLD_ENV,
    API_URL: 'https://api.example.test',
    TOKEN_ENDPOINT: 'token',
    API_USERNAME: 'user',
    API_PASSWORD: 'password',
    PANEL_LIDER_ENDPOINT: 'lider-endpoint',
    PANEL_GENERAL_ENDPOINT: 'general-endpoint',
    PANEL_CEDEARS_ENDPOINT: 'cedears-endpoint',
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

async function loadRoute(
  iolFetch: ReturnType<typeof vi.fn>,
  nodeEnv: NodeJS.ProcessEnv['NODE_ENV'] = 'test'
) {
  vi.resetModules()
  setRequiredEnv(nodeEnv)
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  return import('./route')
}

async function loadRouteWithoutRequiredEnv(iolFetch: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  process.env = {
    NODE_ENV: 'test',
  }
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/iol', () => ({ iolFetch }))

  return import('./route')
}

describe('/api/panel route', () => {
  beforeEach(() => {
    setRequiredEnv()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('returns 400 when the panel type is invalid', async () => {
    const iolFetch = vi.fn()
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=invalid'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      ok: false,
      error: 'INVALID_PANEL_TYPE',
    })
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('falls back to lider when the panel type is omitted', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    expect(iolFetch).toHaveBeenCalledWith('lider-endpoint')
  })

  it('normalizes valid upstream responses', async () => {
    const iolFetch = vi.fn().mockResolvedValue({
      titulos: [
        {
          simbolo: 'YPFD',
          descripcion: 'YPF',
          ultimoPrecio: 100,
          variacionPorcentual: 'invalid',
        },
      ],
    })
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=general'))
    const body = await response.json()

    expectPanelSuccess(body, [
      { simbolo: 'YPFD', descripcion: 'YPF', ultimoPrecio: 100 },
    ])
    expect(iolFetch).toHaveBeenCalledWith('general-endpoint')
  })

  it('uses the cedears endpoint for type=cedears', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'AAPL', descripcion: 'Apple' },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=cedears'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [{ simbolo: 'AAPL', descripcion: 'Apple' }])
    expect(iolFetch).toHaveBeenCalledWith('cedears-endpoint')
  })

  it('returns an empty data array for an empty upstream payload', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ data: [] })
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expectPanelSuccess(body, [])
  })

  it('returns PANEL_ERROR with status 502 for invalid upstream payloads', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ items: [] })
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'Invalid upstream payload structure',
    })
  })

  it('uses cache for a second request to the same panel', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'ALUA', descripcion: 'Aluar' },
    ])
    const { GET } = await loadRoute(iolFetch)

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
    const { GET } = await loadRoute(iolFetch)

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
    const { GET } = await loadRoute(iolFetch)

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
    const { GET } = await loadRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))
    await GET(request('/api/panel?type=lider&refresh=1'))

    const response = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(body).toEqual({
      ok: false,
      error: 'REFRESH_COOLDOWN',
    })
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('keeps manual refresh in cooldown after an upstream refresh failure', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockRejectedValueOnce(new Error('upstream failed'))
    const { GET } = await loadRoute(iolFetch)

    await GET(request('/api/panel?type=lider'))

    const failedRefresh = await GET(request('/api/panel?type=lider&refresh=1'))

    expect(failedRefresh.status).toBe(502)
    expect(await failedRefresh.json()).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'upstream failed',
    })

    const blockedRefresh = await GET(request('/api/panel?type=lider&refresh=1'))
    const body = await blockedRefresh.json()

    expect(blockedRefresh.status).toBe(429)
    expect(blockedRefresh.headers.get('Retry-After')).toBe('15')
    expect(body).toEqual({
      ok: false,
      error: 'REFRESH_COOLDOWN',
    })
    expect(iolFetch).toHaveBeenCalledTimes(2)
  })

  it('keeps normal cache reads working while manual refresh is in cooldown', async () => {
    const iolFetch = vi
      .fn()
      .mockResolvedValueOnce([{ simbolo: 'ALUA', descripcion: 'Aluar' }])
      .mockResolvedValueOnce([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])
    const { GET } = await loadRoute(iolFetch)

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
    const { GET } = await loadRoute(iolFetch)

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
    const { GET } = await loadRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider'))
    const second = GET(request('/api/panel?type=lider'))

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

  it('deduplicates concurrent refresh requests to the same panel', async () => {
    let resolvePanel!: (value: unknown) => void
    const iolFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePanel = resolve
        })
    )
    const { GET } = await loadRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider&refresh=1'))
    const second = GET(request('/api/panel?type=lider&refresh=1'))

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

  it('deduplicates normal requests behind an in-flight manual refresh', async () => {
    let resolvePanel!: (value: unknown) => void
    const iolFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePanel = resolve
        })
    )
    const { GET } = await loadRoute(iolFetch)

    const refresh = GET(request('/api/panel?type=lider&refresh=1'))
    const normal = GET(request('/api/panel?type=lider'))

    resolvePanel([{ simbolo: 'COME', descripcion: 'Comercial del Plata' }])

    const [refreshResponse, normalResponse] = await Promise.all([
      refresh,
      normal,
    ])

    expectPanelSuccess(await refreshResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expectPanelSuccess(await normalResponse.json(), [
      { simbolo: 'COME', descripcion: 'Comercial del Plata' },
    ])
    expect(iolFetch).toHaveBeenCalledTimes(1)
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
    const { GET, clearPanelCacheForTests } = await loadRoute(iolFetch)

    const first = GET(request('/api/panel?type=lider'))

    clearPanelCacheForTests()

    const second = GET(request('/api/panel?type=lider'))

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
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'upstream failed',
    })
  })

  it('sets no-store cache headers for panel responses', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=lider'))

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('does not expose raw upstream payloads from non-local debug requests', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      {
        simbolo: 'GGAL',
        descripcion: 'Grupo Financiero Galicia',
        rawOnly: 'hidden',
      },
    ])
    const { GET } = await loadRoute(iolFetch, 'development')
    process.env.ENABLE_TOKEN_DEBUG = '1'

    const response = await GET(remoteRequest('/api/panel?type=lider&raw=1'))
    const body = await response.json()

    expectPanelSuccess(body, [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
  })

  it('allows raw upstream payloads only for local debug requests', async () => {
    const iolFetch = vi.fn().mockResolvedValue({ upstream: true })
    const { GET } = await loadRoute(iolFetch, 'development')
    process.env.ENABLE_TOKEN_DEBUG = '1'

    const response = await GET(request('/api/panel?type=lider&raw=1'))
    const body = await response.json()

    expect(body).toEqual({
      ok: true,
      type: 'lider',
      data: { upstream: true },
    })
  })

  it('rate limits repeated requests from the same client', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadRoute(iolFetch)
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
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(body).toEqual({
      ok: false,
      error: 'RATE_LIMITED',
    })
  })

  it('prunes expired rate limit entries before counting a new window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T16:00:00.000Z'))

    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadRoute(iolFetch)

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
    expect(body).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'Missing PANEL_LIDER_ENDPOINT',
    })
    expect(iolFetch).not.toHaveBeenCalled()
  })

  it('can be imported without required env vars during build-time analysis', async () => {
    const iolFetch = vi.fn()

    await expect(loadRouteWithoutRequiredEnv(iolFetch)).resolves.toMatchObject({
      dynamic: 'force-dynamic',
      runtime: 'nodejs',
    })
  })

  it('does not expose error details in production', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('secret upstream detail'))
    const { GET } = await loadRoute(iolFetch, 'production')

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
    })
  })

  it('exposes error details outside production', async () => {
    const iolFetch = vi.fn().mockRejectedValue(new Error('development detail'))
    const { GET } = await loadRoute(iolFetch, 'development')

    const response = await GET(request('/api/panel?type=lider'))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      error: 'PANEL_ERROR',
      details: 'development detail',
    })
  })

  it('returns 405 and Allow GET for POST requests', async () => {
    const iolFetch = vi.fn()
    const { POST } = await loadRoute(iolFetch)

    const response = POST()
    const body = await response.json()

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
    expect(body).toEqual({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    })
    expect(iolFetch).not.toHaveBeenCalled()
  })
})
