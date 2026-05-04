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

function request(path: string) {
  return new NextRequest(`http://localhost${path}`)
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

describe('/api/panel route', () => {
  beforeEach(() => {
    setRequiredEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('falls back to lider when the panel type is invalid', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
    ])
    const { GET } = await loadRoute(iolFetch)

    const response = await GET(request('/api/panel?type=invalid'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      data: [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
    })
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

    expect(body).toEqual({
      ok: true,
      data: [{ simbolo: 'YPFD', descripcion: 'YPF', ultimoPrecio: 100 }],
    })
    expect(iolFetch).toHaveBeenCalledWith('general-endpoint')
  })

  it('uses cache for a second request to the same panel', async () => {
    const iolFetch = vi.fn().mockResolvedValue([
      { simbolo: 'ALUA', descripcion: 'Aluar' },
    ])
    const { GET } = await loadRoute(iolFetch)

    await GET(request('/api/panel?type=cedears'))
    const response = await GET(request('/api/panel?type=cedears'))
    const body = await response.json()

    expect(body).toEqual({
      ok: true,
      data: [{ simbolo: 'ALUA', descripcion: 'Aluar' }],
    })
    expect(iolFetch).toHaveBeenCalledTimes(1)
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

    await expect(firstResponse.json()).resolves.toEqual({
      ok: true,
      data: [{ simbolo: 'COME', descripcion: 'Comercial del Plata' }],
    })
    await expect(secondResponse.json()).resolves.toEqual({
      ok: true,
      data: [{ simbolo: 'COME', descripcion: 'Comercial del Plata' }],
    })
    expect(iolFetch).toHaveBeenCalledTimes(1)
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
})
