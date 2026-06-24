// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSelectedStockModal } from './useSelectedStockModal';
import { type StockData } from '@/features/dashboard/shared/stockData';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'GGAL',
    description: 'Grupo Financiero Galicia',
    price: null,
    var: null,
    varType: 'neutral',
    buyQty: null,
    buyPrice: null,
    sellPrice: null,
    sellQty: null,
    open: null,
    min: null,
    max: null,
    close: null,
    volume: null,
    ...overrides,
  };
}

describe('useSelectedStockModal', () => {
  it('selects and clears a stock from current rows', () => {
    const { result } = renderHook(() =>
      useSelectedStockModal({
        rows: [stock()],
        isFavoritesPanel: false,
        favoriteSnapshotsByTicker: {},
      }),
    );

    act(() => {
      result.current.handleStockSelect(stock());
    });

    expect(result.current.selectedStock).toEqual(stock());

    act(() => {
      result.current.handleCloseStockDetails();
    });

    expect(result.current.selectedStock).toBeNull();
  });

  it('falls back to a favorite snapshot when the selected row disappears in favorites', () => {
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useSelectedStockModal({
          rows,
          isFavoritesPanel: true,
          favoriteSnapshotsByTicker: {
            GGAL: stock({ price: 100 }),
          },
        }),
      {
        initialProps: {
          rows: [stock({ price: 125 })],
        },
      },
    );

    act(() => {
      result.current.handleStockSelect(stock({ price: 125 }));
    });

    rerender({ rows: [] });

    expect(result.current.selectedStock).toEqual(stock({ price: 100 }));
  });
});
