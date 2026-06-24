import 'server-only'

import type { NextRequest } from 'next/server'
import {
  buildFavoriteLookupKey,
  MAX_FAVORITE_ITEMS,
  normalizeFavoriteSymbol,
  type FavoriteLookupItem,
} from '@/lib/favorites'
import { isStockHistoryMarket } from '@/lib/stockHistory'

function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9._-]{1,20}$/.test(value)
}

function decodeParamValue(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export type ParsedFavoritesRequest =
  | {
      ok: true
      items: FavoriteLookupItem[]
      bypassCache: boolean
    }
  | {
      ok: false
      error: 'INVALID_ITEMS' | 'TOO_MANY_ITEMS'
    }

export function parseFavoritesRequest(req: NextRequest): ParsedFavoritesRequest {
  const rawItems = req.nextUrl.searchParams.get('items')?.trim() ?? ''

  if (!rawItems) {
    return {
      ok: false,
      error: 'INVALID_ITEMS',
    }
  }

  const parts = rawItems.split(',').filter(Boolean)

  if (parts.length === 0) {
    return {
      ok: false,
      error: 'INVALID_ITEMS',
    }
  }

  if (parts.length > MAX_FAVORITE_ITEMS) {
    return {
      ok: false,
      error: 'TOO_MANY_ITEMS',
    }
  }

  const itemsByKey = new Map<string, FavoriteLookupItem>()

  for (const part of parts) {
    const decoded = decodeParamValue(part)

    if (!decoded) {
      return {
        ok: false,
        error: 'INVALID_ITEMS',
      }
    }

    const [marketPart, symbolPart, ...rest] = decoded.split(':')

    if (rest.length > 0 || !marketPart || !symbolPart) {
      return {
        ok: false,
        error: 'INVALID_ITEMS',
      }
    }

    const market = marketPart.trim()
    const symbol = normalizeFavoriteSymbol(symbolPart)

    if (!isStockHistoryMarket(market) || !isValidSymbol(symbol)) {
      return {
        ok: false,
        error: 'INVALID_ITEMS',
      }
    }

    const item = {
      market,
      symbol,
    }

    itemsByKey.set(buildFavoriteLookupKey(item), item)
  }

  if (itemsByKey.size > MAX_FAVORITE_ITEMS) {
    return {
      ok: false,
      error: 'TOO_MANY_ITEMS',
    }
  }

  return {
    ok: true,
    items: [...itemsByKey.values()],
    bypassCache: req.nextUrl.searchParams.get('refresh') === '1',
  }
}
