import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { type MarketDataPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/marketPanelOptions';
import { mapPanelTituloToStockProps } from '../components/panelTitleToStock';
import {
  fetchMarketPanel,
  getMarketPanelFetchError,
  type MarketPanelSuccessResponse,
} from './marketPanelClient';

export { fetchMarketPanel, getMarketPanelFetchError };

export type MarketPanelViewStatus = 'loading' | 'error' | 'empty' | 'success';

function unknownToError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err ?? 'unknown'));
}

function withRefreshParam(url: string): string {
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}refresh=1`;
}

export function useMarketPanel(activePanelKey: MarketDataPanelKey) {
  const activePanel = getMarketPanelOption(activePanelKey);
  const fetchUrl = activePanel.fetchUrl;

  if (!fetchUrl) {
    throw new Error(`Panel de datos sin fetchUrl: ${activePanelKey}`);
  }
  const refreshInFlightKeysRef = useRef(new Set<string>());
  const [refreshingKeys, setRefreshingKeys] = useState<string[]>([]);
  const [refreshError, setRefreshError] = useState<{
    key: string;
    error: Error;
  } | null>(null);

  const setRefreshInFlight = useCallback((key: string, isInFlight: boolean) => {
    const nextKeys = new Set(refreshInFlightKeysRef.current);

    if (isInFlight) {
      nextKeys.add(key);
    } else {
      nextKeys.delete(key);
    }

    refreshInFlightKeysRef.current = nextKeys;
    setRefreshingKeys([...nextKeys]);
  }, []);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    MarketPanelSuccessResponse,
    Error
  >(
    fetchUrl,
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
    if (refreshInFlightKeysRef.current.has(fetchUrl)) return;

    setRefreshInFlight(fetchUrl, true);
    setRefreshError((currentError) =>
      currentError?.key === fetchUrl ? null : currentError,
    );

    try {
      if (bypassCache) {
        await mutate(
          () => fetchMarketPanel(withRefreshParam(fetchUrl)),
          {
            populateCache: true,
            revalidate: false,
          },
        );
      } else {
        await mutate(() => fetchMarketPanel(fetchUrl), {
          populateCache: true,
          revalidate: false,
        });
      }
    } catch (err: unknown) {
      const nextError = unknownToError(err);

      setRefreshError({
        key: fetchUrl,
        error: nextError,
      });
      throw nextError;
    } finally {
      setRefreshInFlight(fetchUrl, false);
    }
  }, [fetchUrl, mutate, setRefreshInFlight]);

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
    refreshError?.key === fetchUrl ? refreshError.error : null;
  const displayError = activeRefreshError ?? error;
  const hasError = !!displayError;
  const isActivePanelRefreshing =
    refreshingKeys.includes(fetchUrl) ||
    (isValidating && hasData && !hasError);
  const viewStatus: MarketPanelViewStatus = isLoading && !hasData
    ? 'loading'
    : hasError && !hasData
      ? 'error'
      : !hasRows
        ? 'empty'
        : 'success';

  return {
    activePanel,
    rows,
    error: displayError,
    fetchedAt: data?.fetchedAt,
    servedAt: data?.servedAt,
    cacheStatus: data?.cacheStatus,
    refresh,
    viewStatus,
    isInitialLoading: viewStatus === 'loading',
    isRefreshing: isActivePanelRefreshing,
    hasError,
    hasStaleError: hasError && hasData,
    isErrorWithoutData: viewStatus === 'error',
    isEmpty: viewStatus === 'empty',
  };
}
