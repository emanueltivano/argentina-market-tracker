import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { type MarketPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/marketPanelOptions';
import { mapPanelTituloToStockProps } from '../components/panelTitleToStock';
import {
  fetchMarketPanel,
  getMarketPanelFetchError,
  type MarketPanelSuccessResponse,
} from './marketPanelClient';

export { fetchMarketPanel, getMarketPanelFetchError };

export function useMarketPanel(activePanelKey: MarketPanelKey) {
  const activePanel = getMarketPanelOption(activePanelKey);
  const isRefreshInFlightRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<{
    key: string;
    error: Error;
  } | null>(null);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    MarketPanelSuccessResponse,
    Error
  >(
    activePanel.fetchUrl,
    fetchMarketPanel,
    {
      revalidateOnFocus: false,
      // SWR keeps current-key data while revalidating. Keeping this false avoids
      // rendering the previous panel's rows after the user switches panels.
      keepPreviousData: false,
      errorRetryCount: 1,
    },
  );

  const runRefresh = useCallback(async (bypassCache: boolean) => {
    if (isRefreshInFlightRef.current) return;

    isRefreshInFlightRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      if (bypassCache) {
        const separator = activePanel.fetchUrl.includes('?') ? '&' : '?';

        await mutate(
          () => fetchMarketPanel(`${activePanel.fetchUrl}${separator}refresh=1`),
          {
            populateCache: true,
            revalidate: false,
          },
        );
      } else {
        await mutate(() => fetchMarketPanel(activePanel.fetchUrl), {
          populateCache: true,
          revalidate: false,
        });
      }
    } catch (err: unknown) {
      const nextError =
        err instanceof Error ? err : new Error(String(err ?? 'unknown'));

      setRefreshError({
        key: activePanel.fetchUrl,
        error: nextError,
      });
      throw nextError;
    } finally {
      isRefreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [activePanel.fetchUrl, mutate]);

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);
  const autoRefresh = useCallback(() => runRefresh(false), [runRefresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void autoRefresh().catch(() => undefined);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const rows = useMemo(
    () => (data?.data ?? []).map(mapPanelTituloToStockProps),
    [data],
  );
  const hasData = data !== undefined;
  const hasRows = rows.length > 0;
  const activeRefreshError =
    refreshError?.key === activePanel.fetchUrl ? refreshError.error : null;
  const displayError = activeRefreshError ?? error;
  const hasError = !!displayError;

  return {
    activePanel,
    rows,
    error: displayError,
    fetchedAt: data?.fetchedAt,
    servedAt: data?.servedAt,
    cacheStatus: data?.cacheStatus,
    refresh,
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isRefreshing || (isValidating && hasData && !hasError),
    hasError,
    hasStaleError: hasError && hasData,
    isErrorWithoutData: hasError && !hasData,
    isEmpty: hasData && !hasError && !hasRows,
  };
}
