import type { MarketDataPanelKey } from '@/lib/market'
import { isPanelTitulo, type PanelTitulo } from '@/lib/panel'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  isStockHistoryMarket,
  type StockHistoryMarket,
} from '@/lib/stockHistory'

export const MAX_FAVORITE_ITEMS = 25

export type FavoriteStockIdentity = {
  symbol: string
  market: StockHistoryMarket
  sourcePanel?: MarketDataPanelKey
}

export type FavoriteLookupItem = {
  market: StockHistoryMarket
  symbol: string
}

export interface FavoritesSuccessResponse {
  ok: true
  rows: PanelTitulo[]
  missingItems: string[]
  failedItems: string[]
  source: 'demo' | 'live'
  requestId?: string
  updatedAt: string
  servedAt: string
  stale: boolean
}

export const FAVORITES_ERROR_CODES = [
  'FAVORITES_ERROR',
  'INVALID_ITEMS',
  'TOO_MANY_ITEMS',
  'RATE_LIMITED',
  'METHOD_NOT_ALLOWED',
] as const

export type FavoritesErrorCode = (typeof FAVORITES_ERROR_CODES)[number]

export interface FavoritesErrorResponse {
  ok: false
  error: FavoritesErrorCode
  requestId?: string
  details?: string
  missingItems?: string[]
  failedItems?: string[]
}

export type FavoritesResponse = FavoritesSuccessResponse | FavoritesErrorResponse

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFavoriteLookupItem(value: unknown): value is FavoriteLookupItem {
  return (
    isRecord(value) &&
    typeof value.symbol === 'string' &&
    value.symbol.length > 0 &&
    isStockHistoryMarket(
      typeof value.market === 'string' ? value.market : null
    )
  )
}

export function normalizeFavoriteSymbol(value: string): string {
  return value.trim().toUpperCase()
}

export function normalizeFavoriteIdentity(
  value: unknown
): FavoriteStockIdentity | null {
  if (typeof value === 'string') {
    const symbol = normalizeFavoriteSymbol(value)

    return symbol
      ? {
          symbol,
          market: DEFAULT_STOCK_HISTORY_MARKET,
        }
      : null
  }

  if (!isRecord(value)) {
    return null
  }

  const symbol =
    typeof value.symbol === 'string'
      ? normalizeFavoriteSymbol(value.symbol)
      : typeof value.ticker === 'string'
        ? normalizeFavoriteSymbol(value.ticker)
        : ''
  const market = typeof value.market === 'string' ? value.market.trim() : ''
  const sourcePanel =
    value.sourcePanel === 'lider' ||
    value.sourcePanel === 'general' ||
    value.sourcePanel === 'cedears'
      ? value.sourcePanel
      : undefined

  if (!symbol || !isStockHistoryMarket(market || DEFAULT_STOCK_HISTORY_MARKET)) {
    return null
  }

  return {
    symbol,
    market: (market || DEFAULT_STOCK_HISTORY_MARKET) as StockHistoryMarket,
    ...(sourcePanel ? { sourcePanel } : {}),
  }
}

export function normalizeFavoriteIdentities(value: unknown): FavoriteStockIdentity[] {
  if (!Array.isArray(value)) {
    return []
  }

  const identitiesByKey = new Map<string, FavoriteStockIdentity>()

  for (const item of value) {
    const normalized = normalizeFavoriteIdentity(item)

    if (!normalized) {
      continue
    }

    identitiesByKey.set(`${normalized.market}:${normalized.symbol}`, normalized)
  }

  return [...identitiesByKey.values()].sort((left, right) => {
    const symbolSort = left.symbol.localeCompare(right.symbol)

    if (symbolSort !== 0) {
      return symbolSort
    }

    return left.market.localeCompare(right.market)
  })
}

export function buildFavoriteLookupKey(item: FavoriteLookupItem): string {
  return `${item.market}:${item.symbol}`
}

export function buildFavoritesApiPath(items: FavoriteLookupItem[]): string {
  const params = new URLSearchParams({
    items: items.map(buildFavoriteLookupKey).join(','),
  })

  return `/api/favorites?${params.toString()}`
}

export function isFavoritesErrorCode(value: unknown): value is FavoritesErrorCode {
  return (
    typeof value === 'string' &&
    FAVORITES_ERROR_CODES.includes(value as FavoritesErrorCode)
  )
}

export function isFavoritesSuccessResponse(
  value: unknown
): value is FavoritesSuccessResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    Array.isArray(value.rows) &&
    value.rows.every(isPanelTitulo) &&
    Array.isArray(value.missingItems) &&
    value.missingItems.every((item) => typeof item === 'string') &&
    Array.isArray(value.failedItems) &&
    value.failedItems.every((item) => typeof item === 'string') &&
    (value.source === 'demo' || value.source === 'live') &&
    typeof value.updatedAt === 'string' &&
    typeof value.servedAt === 'string' &&
    typeof value.stale === 'boolean'
  )
}

export function isFavoritesErrorResponse(
  value: unknown
): value is FavoritesErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isFavoritesErrorCode(value.error)
  )
}

export { isFavoriteLookupItem }
