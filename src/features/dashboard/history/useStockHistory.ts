import useSWR from 'swr'
import {
  buildStockHistoryApiPath,
  DEFAULT_STOCK_HISTORY_MARKET,
  isStockHistoryMarket,
  type StockHistoryRange,
  type StockHistorySuccessResponse,
} from '@/lib/stockHistory'
import { fetchStockHistory } from './stockHistoryClient'

export function useStockHistory(
  symbol: string,
  range: StockHistoryRange,
  market: string = DEFAULT_STOCK_HISTORY_MARKET
) {
  const normalizedSymbol = symbol.trim()
  const normalizedMarket = market.trim()
  const historyMarket = isStockHistoryMarket(normalizedMarket)
    ? normalizedMarket
    : null
  const fetchUrl =
    normalizedSymbol && historyMarket
      ? buildStockHistoryApiPath(normalizedSymbol, range, historyMarket)
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
  const viewStatus: 'loading' | 'error' | 'empty' | 'success' = isLoading && !hasData
    ? 'loading'
    : error && !hasData
      ? 'error'
      : points.length === 0
        ? 'empty'
        : 'success'

  return {
    points,
    meta: data?.meta,
    error,
    isLoading: viewStatus === 'loading',
    isRefreshing: isValidating && hasData && !error,
    viewStatus,
  }
}
