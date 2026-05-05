import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { type MarketPanelKey } from '@/lib/market';
import { getMarketPanelOption } from '../lib/panelOptions';
import { mapPanelTituloToStockProps } from '../components/panelMapper';
import {
  fetchMarketPanel,
  getMarketPanelFetchError,
  type MarketPanelSuccessResponse,
} from './marketPanelClient';

export { fetchMarketPanel, getMarketPanelFetchError };

export function useMarketPanel(activePanelKey: MarketPanelKey) {
  const activePanel = getMarketPanelOption(activePanelKey);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    MarketPanelSuccessResponse,
    Error
  >(
    activePanel.fetchUrl,
    fetchMarketPanel,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      // SWR keeps current-key data while revalidating. Keeping this false avoids
      // rendering the previous panel's rows after the user switches panels.
      keepPreviousData: false,
      errorRetryCount: 1,
    },
  );

  const refresh = useCallback(async () => {
    const separator = activePanel.fetchUrl.includes('?') ? '&' : '?';

    await mutate(
      () => fetchMarketPanel(`${activePanel.fetchUrl}${separator}refresh=1`),
      {
        populateCache: true,
        revalidate: false,
      },
    );
  }, [activePanel.fetchUrl, mutate]);

  const rows = useMemo(
    () => (data?.data ?? []).map(mapPanelTituloToStockProps),
    [data],
  );
  const hasData = data !== undefined;
  const hasRows = rows.length > 0;
  const hasError = !!error;

  return {
    activePanel,
    rows,
    error,
    fetchedAt: data?.fetchedAt,
    servedAt: data?.servedAt,
    cacheStatus: data?.cacheStatus,
    refresh,
    isInitialLoading: isLoading && !hasData,
    isRefreshing: isValidating && hasData && !hasError,
    hasError,
    hasStaleError: hasError && hasData,
    isErrorWithoutData: hasError && !hasData,
    isEmpty: hasData && !hasError && !hasRows,
  };
}
