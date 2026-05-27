import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { buildFavoritesApiPath, type FavoriteStockIdentity } from '@/lib/favorites'
import { mapPanelTituloToStockProps } from '../lib/panelTitleToStock'
import {
  fetchFavoritePanel,
  type FavoritePanelSuccessResponse,
} from './favoritePanelClient'
import { type MarketPanelViewStatus } from './useMarketPanel'

const AUTO_REFRESH_INTERVAL_MS = 60_000

function unknownToError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err ?? 'unknown'))
}

function withRefreshParam(url: string): string {
  return `${url}&refresh=1`
}

export function useFavoritePanel(items: FavoriteStockIdentity[]) {
  const fetchUrl = useMemo(
    () => (items.length > 0 ? buildFavoritesApiPath(items) : null),
    [items]
  )
  const refreshInFlightKeysRef = useRef(new Set<string>())
  const lastAutoRefreshAtRef = useRef(0)
  const [refreshingKeys, setRefreshingKeys] = useState<string[]>([])
  const [refreshError, setRefreshError] = useState<{
    key: string
    error: Error
  } | null>(null)

  const setRefreshInFlight = useCallback((key: string, isInFlight: boolean) => {
    const nextKeys = new Set(refreshInFlightKeysRef.current)

    if (isInFlight) {
      nextKeys.add(key)
    } else {
      nextKeys.delete(key)
    }

    refreshInFlightKeysRef.current = nextKeys
    setRefreshingKeys([...nextKeys])
  }, [])

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    FavoritePanelSuccessResponse,
    Error
  >(fetchUrl, fetchFavoritePanel, {
    revalidateOnFocus: false,
    revalidateOnMount: fetchUrl !== null,
    keepPreviousData: false,
    errorRetryCount: 1,
  })

  const runRefresh = useCallback(async (bypassCache: boolean) => {
    if (!fetchUrl || refreshInFlightKeysRef.current.has(fetchUrl)) return

    setRefreshInFlight(fetchUrl, true)
    setRefreshError((currentError) =>
      currentError?.key === fetchUrl ? null : currentError
    )

    try {
      await mutate(
        () => fetchFavoritePanel(bypassCache ? withRefreshParam(fetchUrl) : fetchUrl),
        {
          populateCache: true,
          revalidate: false,
        }
      )
    } catch (err: unknown) {
      const nextError = unknownToError(err)

      setRefreshError({
        key: fetchUrl,
        error: nextError,
      })
      throw nextError
    } finally {
      setRefreshInFlight(fetchUrl, false)
    }
  }, [fetchUrl, mutate, setRefreshInFlight])

  const refresh = useCallback(() => runRefresh(true), [runRefresh])
  const autoRefresh = useCallback(async () => {
    lastAutoRefreshAtRef.current = Date.now()
    await runRefresh(false)
  }, [runRefresh])

  useEffect(() => {
    lastAutoRefreshAtRef.current = Date.now()
  }, [fetchUrl])

  useEffect(() => {
    if (!fetchUrl) {
      return
    }

    function tryAutoRefresh() {
      if (document.hidden) {
        return
      }

      void autoRefresh().catch(() => undefined)
    }

    function handleVisibilityChange() {
      if (
        document.hidden ||
        Date.now() - lastAutoRefreshAtRef.current < AUTO_REFRESH_INTERVAL_MS
      ) {
        return
      }

      void autoRefresh().catch(() => undefined)
    }

    const intervalId = window.setInterval(tryAutoRefresh, AUTO_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [autoRefresh, fetchUrl])

  const rows = useMemo(
    () => (data?.rows ?? []).map(mapPanelTituloToStockProps),
    [data]
  )
  const hasData = data !== undefined
  const hasRows = rows.length > 0
  const activeRefreshError =
    fetchUrl && refreshError?.key === fetchUrl ? refreshError.error : null
  const displayError = activeRefreshError ?? error ?? null
  const hasError = !!displayError
  const isRefreshing =
    !!fetchUrl &&
    (refreshingKeys.includes(fetchUrl) || (isValidating && hasData && !hasError))
  const viewStatus: MarketPanelViewStatus = !fetchUrl
    ? 'empty'
    : hasError && !hasData
      ? 'error'
      : isLoading && !hasData
        ? 'loading'
        : !hasRows
          ? 'empty'
          : 'success'

  return {
    rows,
    error: displayError,
    fetchedAt: data?.updatedAt,
    servedAt: data?.servedAt,
    refresh,
    viewStatus,
    isRefreshing,
    hasStaleError: hasError && hasData,
    missingItems: data?.missingItems ?? [],
    failedItems: data?.failedItems ?? [],
    source: data?.source,
    stale: data?.stale ?? false,
  }
}
