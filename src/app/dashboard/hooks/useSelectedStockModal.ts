'use client';

import { useCallback, useMemo, useState } from 'react';
import { resolveSelectedStock } from '../lib/panelState';
import { type StockData } from '../lib/stockData';

type UseSelectedStockModalOptions = {
  rows: StockData[];
  isFavoritesPanel: boolean;
  favoriteSnapshotsByTicker: Record<string, StockData>;
};

export function useSelectedStockModal({
  rows,
  isFavoritesPanel,
  favoriteSnapshotsByTicker,
}: UseSelectedStockModalOptions) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<StockData | null>(null);

  const resolvedSelectedStock = useMemo(
    () =>
      resolveSelectedStock({
        rows,
        selectedTicker,
        isFavoritesPanel,
        favoriteSnapshotsByTicker,
      }),
    [favoriteSnapshotsByTicker, isFavoritesPanel, rows, selectedTicker],
  );

  const selectedStock = resolvedSelectedStock ?? (isFavoritesPanel ? selectedSnapshot : null);

  const handleStockSelect = useCallback((stock: StockData) => {
    setSelectedTicker(stock.ticker);
    setSelectedSnapshot(stock);
  }, []);

  const handleCloseStockDetails = useCallback(() => {
    setSelectedTicker(null);
    setSelectedSnapshot(null);
  }, []);

  return {
    selectedStock,
    handleStockSelect,
    handleCloseStockDetails,
    clearSelectedStock: handleCloseStockDetails,
  };
}
