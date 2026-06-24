import { describe, expect, it } from 'vitest'
import { resolvePanelRows, resolveSelectedStock } from './panelState'
import { type StockData } from '@/features/dashboard/shared/stockData'

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
  }
}

describe('panelState', () => {
  it('returns source rows unchanged outside the favorites panel', () => {
    const rows = [stock()]

    expect(
      resolvePanelRows({
        rows,
        favorites: ['GGAL'],
        favoriteSnapshotsByTicker: {},
        isFavoritesPanel: false,
        viewStatus: 'success',
      }),
    ).toEqual({
      filteredRows: rows,
      staleFavoriteTickers: new Set<string>(),
      effectiveViewStatus: 'success',
    })
  })

  it('merges current rows with favorite snapshots and tracks stale tickers', () => {
    const result = resolvePanelRows({
      rows: [stock({ ticker: 'GGAL' })],
      favorites: ['AAPL', 'GGAL'],
      favoriteSnapshotsByTicker: {
        AAPL: stock({ ticker: 'AAPL', description: 'Apple' }),
        GGAL: stock({ ticker: 'GGAL', price: 100 }),
      },
      isFavoritesPanel: true,
      viewStatus: 'error',
    })

    expect(result.filteredRows.map((row) => row.ticker)).toEqual(['AAPL', 'GGAL'])
    expect([...result.staleFavoriteTickers]).toEqual(['AAPL'])
    expect(result.effectiveViewStatus).toBe('success')
  })

  it('falls back to a favorite snapshot when the selected stock is no longer in rows', () => {
    expect(
      resolveSelectedStock({
        rows: [],
        selectedTicker: 'GGAL',
        isFavoritesPanel: true,
        favoriteSnapshotsByTicker: {
          GGAL: stock({ ticker: 'GGAL', price: 100 }),
        },
      }),
    ).toEqual(stock({ ticker: 'GGAL', price: 100 }))
  })
})
