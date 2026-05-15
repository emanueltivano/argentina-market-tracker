import { normalizeTicker } from './ticker'
import { type MarketPanelViewStatus } from '../hooks/useMarketPanel'
import { type StockData } from './stockData'

type FavoriteSnapshotsByTicker = Record<string, StockData>

export function resolvePanelRows({
  rows,
  favorites,
  favoriteSnapshotsByTicker,
  isFavoritesPanel,
  viewStatus,
}: {
  rows: StockData[]
  favorites: string[]
  favoriteSnapshotsByTicker: FavoriteSnapshotsByTicker
  isFavoritesPanel: boolean
  viewStatus: MarketPanelViewStatus
}) {
  if (!isFavoritesPanel) {
    return {
      filteredRows: rows,
      staleFavoriteTickers: new Set<string>(),
      effectiveViewStatus: viewStatus,
    }
  }

  const rowsByTicker = new Map<string, StockData>()
  const staleTickers = new Set<string>()

  for (const [ticker, row] of Object.entries(favoriteSnapshotsByTicker)) {
    rowsByTicker.set(ticker, row)
    staleTickers.add(ticker)
  }

  for (const row of rows) {
    const ticker = normalizeTicker(row.ticker)

    rowsByTicker.set(ticker, row)
    staleTickers.delete(ticker)
  }

  const filteredRows = favorites
    .map((ticker) => rowsByTicker.get(ticker))
    .filter((row): row is StockData => row !== undefined)

  return {
    filteredRows,
    staleFavoriteTickers: staleTickers,
    effectiveViewStatus: filteredRows.length > 0 ? 'success' : viewStatus,
  }
}

export function resolveSelectedStock({
  rows,
  selectedTicker,
  isFavoritesPanel,
  favoriteSnapshotsByTicker,
}: {
  rows: StockData[]
  selectedTicker: string | null
  isFavoritesPanel: boolean
  favoriteSnapshotsByTicker: FavoriteSnapshotsByTicker
}) {
  return (
    rows.find((row) => row.ticker === selectedTicker) ??
    (isFavoritesPanel && selectedTicker
      ? favoriteSnapshotsByTicker[normalizeTicker(selectedTicker)] ?? null
      : null)
  )
}
