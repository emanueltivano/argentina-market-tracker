import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  buildStockQuoteApiPath,
  type StockQuoteInitialLoadState,
  type StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  isStockHistoryMarket,
} from '@/lib/stockHistory'
import {
  fetchStockQuote,
  StockQuoteRequestError,
} from './stockQuoteClient'

const QUOTE_POLL_INTERVAL_MS = 60_000
const QUOTE_ERROR_BACKOFF_MS = 5_000

export function useStockQuote(
  symbol: string,
  market: string = DEFAULT_STOCK_HISTORY_MARKET,
  options: {
    initialData?: StockQuoteSuccessResponse
    initialState?: StockQuoteInitialLoadState
  } = {}
) {
  const [initialState, setInitialState] = useState<StockQuoteInitialLoadState>(
    options.initialState ?? { status: 'no-initial-data' }
  )
  const [isRetrying, setIsRetrying] = useState(false)
  const manualRetryRef = useRef<Promise<void> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialRetryAfterMsRef = useRef(
    options.initialState && 'retryAfterSec' in options.initialState
      ? options.initialState.retryAfterSec * 1_000
      : 0
  )
  const blockedUntilRef = useRef(0)
  const normalizedSymbol = symbol.trim()
  const normalizedMarket = market.trim()
  const quoteMarket = isStockHistoryMarket(normalizedMarket)
    ? normalizedMarket
    : null
  const fetchUrl =
    normalizedSymbol && quoteMarket
      ? buildStockQuoteApiPath(normalizedSymbol, quoteMarket)
      : null

  const suppressInitialRevalidation =
    initialState.status === 'rate-limited' ||
    initialState.status === 'rate-limit-unavailable'

  useEffect(
    () => () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    },
    [fetchUrl]
  )

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    StockQuoteSuccessResponse,
    StockQuoteRequestError | Error
  >(fetchUrl, fetchStockQuote, {
    revalidateOnFocus: false,
    errorRetryCount: 1,
    refreshInterval: () => {
      if (initialRetryAfterMsRef.current > 0 && blockedUntilRef.current === 0) {
        blockedUntilRef.current = Date.now() + initialRetryAfterMsRef.current
        initialRetryAfterMsRef.current = 0
      }

      return Math.max(
        QUOTE_POLL_INTERVAL_MS,
        blockedUntilRef.current - Date.now()
      )
    },
    fallbackData: options.initialData,
    revalidateOnMount:
      options.initialData || suppressInitialRevalidation ? false : undefined,
    onSuccess: () => {
      blockedUntilRef.current = 0
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    },
    onError: (requestError) => {
      if (
        requestError instanceof StockQuoteRequestError &&
        requestError.retryAfterSec !== undefined
      ) {
        initialRetryAfterMsRef.current = 0
        blockedUntilRef.current = Math.max(
          blockedUntilRef.current,
          Date.now() + requestError.retryAfterSec * 1_000
        )
      }
    },
    onErrorRetry: (requestError, _key, _config, revalidate, retryOptions) => {
      if (
        requestError instanceof StockQuoteRequestError &&
        requestError.status === 404
      ) {
        return
      }

      if (retryOptions.retryCount >= 1) {
        return
      }

      const delay = Math.max(
        QUOTE_ERROR_BACKOFF_MS,
        blockedUntilRef.current - Date.now()
      )

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        void revalidate({ retryCount: retryOptions.retryCount + 1 })
      }, delay)
    },
  })

  const retry = (): Promise<void> => {
    if (manualRetryRef.current) {
      return manualRetryRef.current
    }

    setIsRetrying(true)
    const promise = (async () => {
      try {
        const nextData = await mutate()

        if (nextData) {
          setInitialState({ status: 'available' })
        }
      } catch (requestError: unknown) {
        if (
          requestError instanceof StockQuoteRequestError &&
          (requestError.code === 'RATE_LIMITED' ||
            requestError.code === 'RATE_LIMIT_UNAVAILABLE')
        ) {
          setInitialState({
            status:
              requestError.code === 'RATE_LIMITED'
                ? 'rate-limited'
                : 'rate-limit-unavailable',
            retryAfterSec: requestError.retryAfterSec ?? 0,
          })
        }
      }
    })()

    manualRetryRef.current = promise
    void promise.then(() => {
      if (manualRetryRef.current === promise) {
        manualRetryRef.current = null
      }
      setIsRetrying(false)
    })
    return promise
  }

  const resolvedInitialState: StockQuoteInitialLoadState = data
    ? { status: 'available' }
    : initialState

  return {
    quote: data?.data ?? null,
    source: data?.source ?? null,
    cacheStatus: data?.cacheStatus,
    stale: data?.stale ?? false,
    fetchedAt: data?.fetchedAt,
    servedAt: data?.servedAt,
    staleUntil: data?.staleUntil,
    error,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
    isRetrying,
    initialState: resolvedInitialState,
    retry,
  }
}
