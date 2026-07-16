import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StockQuoteSuccessResponse } from '@/lib/stockQuote'
import type { StockQuoteInitialLoadState } from '@/lib/stockQuote'

const mocks = vi.hoisted(() => ({
  getStockQuoteResponse: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: 'localhost' })),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

class MockIolUpstreamHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
  }
}

class MockStockQuoteRateLimitError extends Error {
  constructor(
    public readonly code: 'RATE_LIMITED' | 'RATE_LIMIT_UNAVAILABLE',
    public readonly status: 429 | 503,
    public readonly headers: Record<string, string>
  ) {
    super(code)
  }
}

function quoteResponse(): StockQuoteSuccessResponse {
  return {
    ok: true,
    data: {
      symbol: 'GGAL',
      market: 'bcba',
      description: 'Grupo Financiero Galicia S.A.',
      price: 7615,
      variation: -4.33,
      open: 7860,
      high: 7950,
      low: 7575,
      timestamp: '2026-06-24T16:59:55.3901383-03:00',
      previousClose: 7960,
      amountTraded: 20190703365,
      volume: 164867,
      averagePrice: 7700,
      currency: 'peso_Argentino',
      openInterest: 0,
      operationCount: 8864,
      settlement: 't1',
      minimumSheet: 1,
      lot: 1,
      minimumQuantity: 1,
      depth: [],
    },
    fetchedAt: '2026-06-24T20:00:00.000Z',
    servedAt: '2026-06-24T20:00:00.000Z',
    staleUntil: '2026-06-24T20:02:00.000Z',
    cacheStatus: 'fresh',
    stale: false,
    source: 'live',
    market: 'bCBA',
    symbol: 'GGAL',
  }
}

function props(symbol: string) {
  return { params: Promise.resolve({ symbol }) }
}

async function loadPage() {
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('next/headers', () => ({ headers: mocks.headers }))
  vi.doMock('next/navigation', () => ({ notFound: mocks.notFound }))
  vi.doMock('@/lib/server/quote/quoteService', () => ({
    getStockQuoteResponse: mocks.getStockQuoteResponse,
    StockQuoteRateLimitError: MockStockQuoteRateLimitError,
  }))
  vi.doMock('@/lib/server/upstream/iol', () => ({
    IolUpstreamHttpError: MockIolUpstreamHttpError,
  }))
  vi.doMock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>()

    return {
      ...actual,
      cache: <TArgs extends unknown[], TResult>(
        fn: (...args: TArgs) => TResult
      ) => {
        const values = new Map<string, TResult>()

        return (...args: TArgs) => {
          const key = JSON.stringify(args)

          if (!values.has(key)) {
            values.set(key, fn(...args))
          }

          return values.get(key) as TResult
        }
      },
    }
  })
  vi.doMock(
    '@/features/dashboard/stock-detail/StockDetailPageClient',
    () => ({
      default: ({
        symbol,
        initialQuote,
        initialQuoteState,
      }: {
        symbol: string
        initialQuote?: StockQuoteSuccessResponse
        initialQuoteState?: StockQuoteInitialLoadState
      }) => (
        <div
          data-testid="stock-client"
          data-symbol={symbol}
          data-initial-symbol={initialQuote?.symbol}
          data-initial-stale={initialQuote?.stale || undefined}
          data-initial-status={initialQuoteState?.status}
          data-retry-after={
            initialQuoteState && 'retryAfterSec' in initialQuoteState
              ? initialQuoteState.retryAfterSec
              : undefined
          }
        />
      ),
    })
  )

  return import('./page')
}

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('/stocks/[symbol] page', () => {
  it('builds stable asset-specific metadata and a normalized canonical', async () => {
    mocks.getStockQuoteResponse.mockResolvedValue({
      cacheStatus: 'fresh',
      response: quoteResponse(),
    })
    const { generateMetadata } = await loadPage()

    const metadata = await generateMetadata(props('ggal'))
    const serialized = JSON.stringify(metadata)

    expect(metadata).toMatchObject({
      title: 'Grupo Financiero Galicia S.A. (GGAL)',
      description: expect.stringContaining(
        'Grupo Financiero Galicia S.A. (GGAL)'
      ),
      alternates: { canonical: '/stocks/GGAL' },
      openGraph: {
        title: 'Grupo Financiero Galicia S.A. (GGAL)',
        url: '/stocks/GGAL',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: 'Grupo Financiero Galicia S.A. (GGAL)',
      },
    })
    expect(serialized).not.toContain('7615')
    expect(serialized).not.toContain('-4.33')
    expect(serialized).not.toContain('2026-06-24')
  })

  it('uses notFound for a syntactically invalid symbol without lookup', async () => {
    const { default: StockPage, generateMetadata } = await loadPage()

    await expect(generateMetadata(props('bad symbol!'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
    await expect(StockPage(props('%E0%A4%A'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
    expect(mocks.getStockQuoteResponse).not.toHaveBeenCalled()
  })

  it('uses notFound when the data source confirms the asset is absent', async () => {
    mocks.getStockQuoteResponse.mockResolvedValue({
      cacheStatus: 'fresh',
      response: null,
    })
    const { default: StockPage } = await loadPage()

    await expect(StockPage(props('NOPE'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  it('uses notFound for a confirmed upstream 404', async () => {
    mocks.getStockQuoteResponse.mockRejectedValue(
      new MockIolUpstreamHttpError('missing', 404)
    )
    const { generateMetadata } = await loadPage()

    await expect(generateMetadata(props('NOPE'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })

  it('keeps a valid page available during a temporary upstream failure', async () => {
    mocks.getStockQuoteResponse.mockRejectedValue(
      new Error('temporary upstream failure')
    )
    const { default: StockPage, generateMetadata } = await loadPage()
    const pageProps = props('ggal')

    const [metadata, element] = await Promise.all([
      generateMetadata(pageProps),
      StockPage(pageProps),
    ])
    const html = renderToStaticMarkup(element)

    expect(metadata).toMatchObject({
      title: 'GGAL - Datos de mercado',
      alternates: { canonical: '/stocks/GGAL' },
    })
    expect(html).toContain('data-symbol="GGAL"')
    expect(html).not.toContain('data-initial-symbol')
    expect(html).toContain('data-initial-status="upstream-unavailable"')
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.getStockQuoteResponse).toHaveBeenCalledOnce()
  })

  it.each([
    ['RATE_LIMITED' as const, 429 as const, 'rate-limited'],
    [
      'RATE_LIMIT_UNAVAILABLE' as const,
      503 as const,
      'rate-limit-unavailable',
    ],
  ])(
    'passes an explicit %s SSR state and retry delay to the client',
    async (code, status, expectedStatus) => {
      mocks.getStockQuoteResponse.mockRejectedValue(
        new MockStockQuoteRateLimitError(code, status, { 'Retry-After': '17' })
      )
      const { default: StockPage } = await loadPage()

      const element = await StockPage(props('GGAL'))
      const html = renderToStaticMarkup(element)

      expect(html).toContain(`data-initial-status="${expectedStatus}"`)
      expect(html).toContain('data-retry-after="17"')
      expect(mocks.getStockQuoteResponse).toHaveBeenCalledOnce()
    }
  )

  it('passes the SSR quote to the client and shares one lookup with metadata', async () => {
    mocks.getStockQuoteResponse.mockResolvedValue({
      cacheStatus: 'memory-cache',
      response: quoteResponse(),
    })
    const { default: StockPage, generateMetadata } = await loadPage()
    const pageProps = props('GGAL')

    const [metadata, element] = await Promise.all([
      generateMetadata(pageProps),
      StockPage(pageProps),
    ])
    const html = renderToStaticMarkup(element)

    expect(metadata.title).toBe('Grupo Financiero Galicia S.A. (GGAL)')
    expect(html).toContain('data-symbol="GGAL"')
    expect(html).toContain('data-initial-symbol="GGAL"')
    expect(mocks.getStockQuoteResponse).toHaveBeenCalledOnce()
    expect(mocks.getStockQuoteResponse).toHaveBeenCalledWith(
      'GGAL',
      'bCBA',
      expect.objectContaining({
        rateLimitIdentity: {
          key: 'loopback:localhost',
          source: 'local-loopback',
        },
        route: '/stocks/[symbol]',
      })
    )
  })

  it('passes stale quote metadata through SSR without losing the snapshot', async () => {
    mocks.getStockQuoteResponse.mockResolvedValue({
      cacheStatus: 'stale',
      response: {
        ...quoteResponse(),
        cacheStatus: 'stale',
        stale: true,
        degradationReason: 'upstream-unavailable',
      },
    })
    const { default: StockPage } = await loadPage()

    const element = await StockPage(props('GGAL'))
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-initial-symbol="GGAL"')
    expect(html).toContain('data-initial-stale="true"')
  })
})
