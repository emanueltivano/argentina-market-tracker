import useSWR from 'swr'
import {
  type StockHistoryRange,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'
import { fetchStockHistory } from './stockHistoryClient'

const DEFAULT_MARKET = 'bCBA'

function buildStockHistoryUrl(
  symbol: string,
  range: StockHistoryRange,
  market: string
): string {
  const params = new URLSearchParams({
    range,
    market,
  })

  return `/api/stocks/${encodeURIComponent(symbol)}/history?${params.toString()}`
}

export function useStockHistory(
  symbol: string,
  range: StockHistoryRange,
  market = DEFAULT_MARKET
) {
  const normalizedSymbol = symbol.trim()
  const normalizedMarket = market.trim()
  const fetchUrl =
    normalizedSymbol && normalizedMarket
      ? buildStockHistoryUrl(normalizedSymbol, range, normalizedMarket)
      : null

  const { data, error, isLoading, isValidating } = useSWR<
    StockHistorySuccessResponse,
    Error
  >(fetchUrl, fetchStockHistory, {
    revalidateOnFocus: false,
    errorRetryCount: 1,
  })

  const points = data?.data ?? []
  const hasData = data !== undefined
  const viewStatus = isLoading && !hasData
    ? 'loading'
    : error && !hasData
      ? 'error'
      : points.length === 0
        ? 'empty'
        : 'success'

  return {
    points,
    error,
    isLoading: viewStatus === 'loading',
    isRefreshing: isValidating && hasData && !error,
    viewStatus,
  }
}
