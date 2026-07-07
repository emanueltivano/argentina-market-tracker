import useSWR from 'swr'
import {
  buildStockQuoteApiPath,
  type StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  isStockHistoryMarket,
} from '@/lib/stockHistory'
import { fetchStockQuote } from './stockQuoteClient'

export function useStockQuote(
  symbol: string,
  market: string = DEFAULT_STOCK_HISTORY_MARKET
) {
  const normalizedSymbol = symbol.trim()
  const normalizedMarket = market.trim()
  const quoteMarket = isStockHistoryMarket(normalizedMarket)
    ? normalizedMarket
    : null
  const fetchUrl =
    normalizedSymbol && quoteMarket
      ? buildStockQuoteApiPath(normalizedSymbol, quoteMarket)
      : null

  const { data, error, isLoading, isValidating } = useSWR<
    StockQuoteSuccessResponse,
    Error
  >(fetchUrl, fetchStockQuote, {
    revalidateOnFocus: false,
    errorRetryCount: 1,
    refreshInterval: 60_000,
  })

  return {
    quote: data?.data ?? null,
    source: data?.source ?? null,
    error,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
  }
}
