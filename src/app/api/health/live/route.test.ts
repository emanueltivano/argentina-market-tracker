import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }

async function loadRoute() {
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  return import('./route')
}

describe('/api/health/live route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = { ...OLD_ENV }
  })

  it('returns 200 without contacting Redis even when it is unavailable', async () => {
    process.env.RATE_LIMIT_STORE = 'redis-rest'
    process.env.RATE_LIMIT_REDIS_REST_URL = 'https://redis.internal.test'
    process.env.RATE_LIMIT_REDIS_REST_TOKEN = 'redis-secret-token'
    const fetchMock = vi.fn().mockRejectedValue(new Error('Redis is down'))
    vi.stubGlobal('fetch', fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(
      new NextRequest('http://localhost/api/health/live')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      service: 'application',
      status: 'ok',
    })
    expect(Number.isNaN(Date.parse(body.checkedAt))).toBe(false)
    expect(JSON.stringify(body)).not.toContain('redis.internal.test')
    expect(JSON.stringify(body)).not.toContain('redis-secret-token')
    expect(JSON.stringify(body)).not.toContain('RATE_LIMIT')
  })
})
