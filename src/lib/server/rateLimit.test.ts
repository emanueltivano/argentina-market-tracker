import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env

function request(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(`http://localhost${path}`, init)
}

describe('rateLimit infrastructure', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
    process.env = OLD_ENV
  })

  it('uses an in-memory fixed window store in development', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'development',
      RATE_LIMIT_STORE: 'memory',
    }
    vi.doMock('server-only', () => ({}))
    const { rateLimitTestExports } = await import('./rateLimit')
    const store = rateLimitTestExports.createMemoryRateLimitStore()

    const first = await store.incrementFixedWindow('bucket', {
      now: 0,
      ttlMs: 60_000,
      maxKeys: 10,
    })
    const second = await store.incrementFixedWindow('bucket', {
      now: 1,
      ttlMs: 60_000,
      maxKeys: 10,
    })

    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
  })

  it('ignores spoofable proxy headers when proxy trust is disabled', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      RATE_LIMIT_TRUSTED_PROXY: 'none',
    }
    vi.doMock('server-only', () => ({}))
    const { rateLimitTestExports } = await import('./rateLimit')

    const first = rateLimitTestExports.resolveClientKey(
      request('/api/panel', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )
    const second = rateLimitTestExports.resolveClientKey(
      request('/api/panel', {
        headers: { 'x-forwarded-for': '198.51.100.20' },
      })
    )

    expect(first).toEqual({
      key: 'loopback:localhost',
      source: 'local-loopback',
    })
    expect(second).toEqual(first)
  })

  it('uses trusted proxy IPs only when explicitly configured', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      RATE_LIMIT_TRUSTED_PROXY: 'vercel',
      VERCEL: '1',
    }
    vi.doMock('server-only', () => ({}))
    const { rateLimitTestExports } = await import('./rateLimit')

    const result = rateLimitTestExports.resolveClientKey(
      request('/api/panel', {
        headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.20' },
      })
    )

    expect(result).toEqual({
      key: 'ip:203.0.113.10',
      source: 'trusted-proxy-ip',
    })
  })

  it('supports a Redis REST store through the store abstraction', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
    }
    vi.doMock('server-only', () => ({}))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ result: 1 }))
      .mockResolvedValueOnce(Response.json({ result: 'OK' }))
      .mockResolvedValueOnce(Response.json({ result: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const { rateLimitTestExports } = await import('./rateLimit')
    const store = rateLimitTestExports.createRedisRestRateLimitStore({
      url: 'https://redis.example.test',
      token: 'secret-token',
    })

    const first = await store.incrementFixedWindow('bucket', {
      now: 0,
      ttlMs: 120_000,
    })
    const second = await store.incrementFixedWindow('bucket', {
      now: 1,
      ttlMs: 120_000,
    })

    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://redis.example.test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        }),
        body: JSON.stringify(['INCR', 'bucket']),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://redis.example.test',
      expect.objectContaining({
        body: JSON.stringify(['PEXPIRE', 'bucket', 120000]),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://redis.example.test',
      expect.objectContaining({
        body: JSON.stringify(['INCR', 'bucket']),
      })
    )
  })

  it('returns a controlled unavailable result when the store check throws', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      RATE_LIMIT_STORE: 'redis-rest',
      RATE_LIMIT_REDIS_REST_URL: 'https://kv.internal.example.test',
      RATE_LIMIT_REDIS_REST_TOKEN: 'RATE_LIMIT_REDIS_REST_TOKEN-secret',
    }
    vi.doMock('server-only', () => ({}))
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { safeCheckRateLimit } = await import('./rateLimit')

    const result = await safeCheckRateLimit(
      () => {
        throw new Error(
          'redis failed for https://kv.internal.example.test using RATE_LIMIT_REDIS_REST_TOKEN-secret'
        )
      },
      {
        requestId: 'req-12345678',
        route: '/api/panel',
      }
    )

    expect(result).toEqual({
      ok: false,
      error: 'RATE_LIMIT_UNAVAILABLE',
      retryAfterSec: 5,
      status: 503,
    })
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
      'https://kv.internal.example.test'
    )
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
      'RATE_LIMIT_REDIS_REST_TOKEN-secret'
    )
  })

  it('reports degraded runtime info when live mode falls back to memory and global identity', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      MARKET_DATA_SOURCE: 'live',
      RATE_LIMIT_STORE: 'memory',
      RATE_LIMIT_TRUSTED_PROXY: 'none',
    }
    vi.doMock('server-only', () => ({}))
    const { getRateLimitRuntimeInfo } = await import('./rateLimit')

    expect(getRateLimitRuntimeInfo()).toEqual({
      configuredStore: 'memory',
      ok: false,
      reasons: ['memory-store-fallback', 'shared-global-client-fallback'],
      status: 'degraded',
      storeMode: 'memory',
      trustedProxy: 'none',
    })
  })
})
