import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = process.env
type ObservabilitySnapshot = ReturnType<
  typeof import('@/lib/server/core/observability')['getObservabilitySnapshot']
>

function quotePayload(symbol: string) {
  return {
    simbolo: symbol,
    descripcionTitulo: symbol,
    ultimoPrecio: 100,
    variacion: 1,
    puntas: [],
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('/api/favorites quote-upstream budget', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      MARKET_DATA_SOURCE: 'live',
      API_URL: 'https://api.example.test',
      TOKEN_ENDPOINT: 'token',
      API_USERNAME: 'user',
      API_PASSWORD: 'password',
      RATE_LIMIT_STORE: 'memory',
    }
    vi.doMock('server-only', () => ({}))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
    process.env = OLD_ENV
  })

  async function loadRoute() {
    const route = await import('./route')
    const observability = await import('@/lib/server/core/observability')
    const rateLimit = await import('@/lib/server/core/rateLimit')
    const favorites = await import('@/lib/server/favorites/favoritesService')
    const tokenCache = await import('@/lib/server/upstream/tokenCache')
    observability.clearObservabilityStateForTests()
    rateLimit.clearRateLimitStateForTests()
    favorites.clearFavoritesStateForTests()
    tokenCache.clearCachedToken()
    return { favorites, observability, rateLimit, route }
  }

  function counterValue(
    snapshot: ObservabilitySnapshot,
    namespace: string,
    outcome = 'allowed'
  ) {
    return (
      snapshot.counters.find(
        (counter) =>
          counter.name === 'rate_limit.check.total' &&
          counter.tags.namespace === namespace &&
          counter.tags.outcome === outcome
      )?.value ?? 0
    )
  }

  it('uses one upstream unit per real lookup, two for distinct symbols, and none for cache hits', async () => {
    const providerCalls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/token')) {
          return jsonResponse({ access_token: 'token', expires_in: 1800 })
        }
        const symbol = decodeURIComponent(url.split('/').at(-2) ?? '')
        providerCalls.push(symbol)
        return jsonResponse(quotePayload(symbol))
      })
    )
    const { observability, route } = await loadRoute()
    const request = new NextRequest(
      'http://localhost/api/favorites?items=bCBA:ALUA,bCBA:AAPL'
    )

    expect((await route.GET(request)).status).toBe(200)
    let snapshot = observability.getObservabilitySnapshot()
    expect(counterValue(snapshot, 'quote-upstream')).toBe(2)
    expect(counterValue(snapshot, 'favorites-public')).toBe(1)
    expect(providerCalls).toEqual(['ALUA', 'AAPL'])

    expect((await route.GET(request)).status).toBe(200)
    snapshot = observability.getObservabilitySnapshot()
    expect(counterValue(snapshot, 'quote-upstream')).toBe(2)
    expect(counterValue(snapshot, 'favorites-public')).toBe(2)
    expect(providerCalls).toHaveLength(2)
  })

  it('deduplicates concurrent favorites lookups for the same symbol before the budget', async () => {
    let resolveProvider!: (response: Response) => void
    const provider = new Promise<Response>((resolve) => {
      resolveProvider = resolve
    })
    let providerCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/token')) {
          return Promise.resolve(
            jsonResponse({ access_token: 'token', expires_in: 1800 })
          )
        }
        providerCalls += 1
        return provider
      })
    )
    const { favorites, observability } = await loadRoute()
    const options = {
      bypassCache: false,
      rateLimitIdentity: {
        key: 'loopback:localhost',
        source: 'local-loopback' as const,
      },
    }

    const first = favorites.getFavoritesResponse(
      [{ market: 'bCBA', symbol: 'GGAL' }],
      options
    )
    const second = favorites.getFavoritesResponse(
      [{ market: 'bCBA', symbol: 'GGAL' }],
      options
    )
    await vi.waitFor(() => expect(providerCalls).toBe(1))
    resolveProvider(jsonResponse(quotePayload('GGAL')))
    await Promise.all([first, second])

    expect(counterValue(observability.getObservabilitySnapshot(), 'quote-upstream')).toBe(1)
    expect(providerCalls).toBe(1)
  })

  it('keeps a partial response when the upstream budget is exhausted mid fan-out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/token')) {
          return jsonResponse({ access_token: 'token', expires_in: 1800 })
        }
        const symbol = decodeURIComponent(url.split('/').at(-2) ?? '')
        return jsonResponse(quotePayload(symbol))
      })
    )
    const { observability, route } = await loadRoute()
    const { executeProtectedQuoteLookup } = await import(
      '@/lib/server/quote/protectedQuoteLookup'
    )
    const context = {
      rateLimitIdentity: {
        key: 'loopback:localhost',
        source: 'local-loopback' as const,
      },
      route: '/test/seed',
    }

    for (let index = 0; index < 119; index += 1) {
      await executeProtectedQuoteLookup({
        context,
        market: 'bCBA',
        symbol: `SEED${index}`,
        lookup: async () => null,
      })
    }

    const response = await route.GET(
      new NextRequest(
        'http://localhost/api/favorites?items=bCBA:ALUA,bCBA:AAPL'
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rows).toHaveLength(1)
    expect(body.failedItems).toHaveLength(1)
    expect(body.missingItems).toEqual([])
    const snapshot = observability.getObservabilitySnapshot()
    expect(counterValue(snapshot, 'quote-upstream', 'allowed')).toBe(120)
    expect(counterValue(snapshot, 'quote-upstream', 'blocked')).toBe(1)
  })

  it('preserves an upstream budget store failure instead of reporting a missing quote', async () => {
    process.env.RATE_LIMIT_STORE = 'redis-rest'
    process.env.RATE_LIMIT_REDIS_REST_URL = 'https://redis.example.test'
    process.env.RATE_LIMIT_REDIS_REST_TOKEN = 'secret-token'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('redis unavailable'))
    )
    const { favorites } = await loadRoute()

    await expect(
      favorites.getFavoritesResponse(
        [{ market: 'bCBA', symbol: 'GGAL' }],
        {
          bypassCache: false,
          rateLimitIdentity: {
            key: 'loopback:localhost',
            source: 'local-loopback',
          },
        }
      )
    ).rejects.toMatchObject({
      name: 'QuoteUpstreamBudgetError',
      code: 'RATE_LIMIT_UNAVAILABLE',
      status: 503,
    })
  })
})
