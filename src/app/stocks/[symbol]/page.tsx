import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import StockDetailPageClient from '@/features/dashboard/stock-detail/StockDetailPageClient'
import { DEFAULT_STOCK_HISTORY_MARKET } from '@/lib/stockHistory'
import type {
  StockQuoteInitialLoadState,
  StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import { parseStockSymbolParam } from '@/lib/stockSymbol'
import { getSafeErrorDetails, logServerWarn } from '@/lib/server/core/observability'
import { resolveRateLimitIdentity } from '@/lib/server/core/rateLimit'
import {
  getStockQuoteResponse,
  StockQuoteRateLimitError,
} from '@/lib/server/quote/quoteService'
import { IolUpstreamHttpError } from '@/lib/server/upstream/iol'

type StockPageProps = {
  params: Promise<{
    symbol: string
  }>
}

type StockPageResolution =
  | {
      status: 'found'
      initialState: StockQuoteInitialLoadState
      quote: StockQuoteSuccessResponse
    }
  | {
      status: 'not-found' | 'unavailable'
      initialState: StockQuoteInitialLoadState
      quote: null
    }

const resolveStockPageData = cache(
  async (symbol: string): Promise<StockPageResolution> => {
    try {
      const requestHeaders = await headers()
      const host = requestHeaders.get('host')?.trim() ?? ''
      let hostname = ''

      try {
        hostname = host ? new URL(`http://${host}`).hostname : ''
      } catch {
        hostname = ''
      }

      const result = await getStockQuoteResponse(
        symbol,
        DEFAULT_STOCK_HISTORY_MARKET,
        {
          rateLimitIdentity: resolveRateLimitIdentity(
            requestHeaders,
            hostname
          ),
          route: '/stocks/[symbol]',
        }
      )

      return result.response
        ? {
            status: 'found',
            initialState: { status: 'available' },
            quote: result.response,
          }
        : {
            status: 'not-found',
            initialState: { status: 'not-found' },
            quote: null,
          }
    } catch (error: unknown) {
      if (error instanceof IolUpstreamHttpError && error.status === 404) {
        return {
          status: 'not-found',
          initialState: { status: 'not-found' },
          quote: null,
        }
      }

      if (error instanceof StockQuoteRateLimitError) {
        const parsedRetryAfter = Number.parseInt(
          error.headers['Retry-After'] ?? '',
          10
        )

        return {
          status: 'unavailable',
          initialState: {
            status:
              error.code === 'RATE_LIMITED'
                ? 'rate-limited'
                : 'rate-limit-unavailable',
            retryAfterSec:
              Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
                ? parsedRetryAfter
                : 5,
          },
          quote: null,
        }
      }

      logServerWarn('stock-page.quote.unavailable', {
        symbol,
        market: DEFAULT_STOCK_HISTORY_MARKET,
        reason: getSafeErrorDetails(error),
      })
      return {
        status: 'unavailable',
        initialState: { status: 'upstream-unavailable' },
        quote: null,
      }
    }
  }
)

async function resolvePage(
  params: StockPageProps['params']
): Promise<{ symbol: string; resolution: StockPageResolution }> {
  const { symbol: rawSymbol } = await params
  const symbol = parseStockSymbolParam(rawSymbol)

  if (!symbol) {
    notFound()
  }

  const resolution = await resolveStockPageData(symbol)

  if (resolution.status === 'not-found') {
    notFound()
  }

  return { symbol, resolution }
}

function getAssetPresentation(
  symbol: string,
  quote: StockQuoteSuccessResponse | null
) {
  const description = quote?.data.description.trim()
  const assetName = description && description !== symbol ? description : null
  const identity = assetName ? `${assetName} (${symbol})` : symbol
  const title = assetName
    ? `${assetName} (${symbol})`
    : `${symbol} - Datos de mercado`
  const summary = `Información de mercado de ${identity} en ${DEFAULT_STOCK_HISTORY_MARKET}. Consultá el detalle y el histórico del activo en Argentina Market Tracker.`

  return { summary, title }
}

export async function generateMetadata({
  params,
}: StockPageProps): Promise<Metadata> {
  const { symbol, resolution } = await resolvePage(params)
  const canonical = `/stocks/${encodeURIComponent(symbol)}`
  const presentation = getAssetPresentation(symbol, resolution.quote)

  return {
    title: presentation.title,
    description: presentation.summary,
    alternates: { canonical },
    openGraph: {
      title: presentation.title,
      description: presentation.summary,
      url: canonical,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: presentation.title,
      description: presentation.summary,
    },
  }
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol, resolution } = await resolvePage(params)

  return (
    <StockDetailPageClient
      symbol={symbol}
      initialQuote={resolution.quote ?? undefined}
      initialQuoteState={resolution.initialState}
    />
  )
}
