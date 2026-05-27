import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env

function request(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

function remoteRequest(path: string) {
  return new NextRequest(`https://preview.example.test${path}`)
}

async function loadRoute() {
  vi.resetModules()
  process.env = {
    ...OLD_ENV,
    API_URL: 'https://api.example.test',
    API_USERNAME: 'user',
    API_PASSWORD: 'password',
    ENABLE_TOKEN_DEBUG: '1',
    NODE_ENV: 'development',
  }
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/server/tokenCache', () => ({
    getCachedToken: vi.fn(() => null),
  }))
  vi.doMock('@/lib/server/iol', () => ({
    IolTokenFormatError: class IolTokenFormatError extends Error {},
    IolTokenUpstreamError: class IolTokenUpstreamError extends Error {
      status = 502
    },
    refreshTokenForDebug: vi.fn(async () => ({ expiresIn: 1800 })),
  }))

  return import('./route')
}

describe('/api/token debug route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('allows debug token refresh only from local development requests', async () => {
    const { POST } = await loadRoute()

    const response = await POST(request('/api/token'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      cached: false,
      status: 'refreshed',
    })
    expect(response.headers.get('X-Request-Id')).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })

  it('returns not found for remote hosts even when debug is enabled', async () => {
    const { POST } = await loadRoute()

    const response = await POST(remoteRequest('/api/token'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    })
    expect(body.requestId).toEqual(expect.any(String))
  })

  it('returns not found in production even when the debug flag is set', async () => {
    const { POST } = await loadRoute()
    vi.stubEnv('NODE_ENV', 'production')

    const response = await POST(request('/api/token'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    })
    expect(body.requestId).toEqual(expect.any(String))
  })
})
