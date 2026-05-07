import {
  DEFAULT_STOCK_SORT,
  type StockSort,
  type StockSortDirection,
  type StockSortKey,
} from './stockSorting'

export const STOCK_SORT_STORAGE_KEY = 'argentina-market-tracker:stock-sort'

const STOCK_SORT_KEYS = ['ticker', 'price', 'var', 'volume'] as const
const STOCK_SORT_DIRECTIONS = ['asc', 'desc'] as const

function isStockSortKey(value: unknown): value is StockSortKey {
  return (
    typeof value === 'string' &&
    STOCK_SORT_KEYS.includes(value as StockSortKey)
  )
}

function isStockSortDirection(value: unknown): value is StockSortDirection {
  return (
    typeof value === 'string' &&
    STOCK_SORT_DIRECTIONS.includes(value as StockSortDirection)
  )
}

export function parseStockSort(
  sort: unknown,
  direction: unknown
): StockSort | null {
  if (!isStockSortKey(sort) || !isStockSortDirection(direction)) {
    return null
  }

  return {
    key: sort,
    direction,
  }
}

export function parseStockSortSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>
): StockSort | null {
  return parseStockSort(searchParams.get('sort'), searchParams.get('dir'))
}

export function parseStoredStockSort(value: string | null): StockSort | null {
  if (!value) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)

    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }

    const record = parsed as Record<string, unknown>

    return parseStockSort(record.key, record.direction)
  } catch {
    return null
  }
}

export function serializeStockSort(sort: StockSort): string {
  return JSON.stringify({
    key: sort.key,
    direction: sort.direction,
  })
}

export function resolveInitialStockSort(
  searchParams: Pick<URLSearchParams, 'get'>,
  storedValue: string | null
): StockSort {
  const sortParam = searchParams.get('sort')
  const directionParam = searchParams.get('dir')
  const hasSortParams = sortParam !== null || directionParam !== null

  if (hasSortParams) {
    return parseStockSort(sortParam, directionParam) ?? DEFAULT_STOCK_SORT
  }

  return (
    parseStoredStockSort(storedValue) ??
    DEFAULT_STOCK_SORT
  )
}

export function setStockSortSearchParams(
  searchParams: URLSearchParams,
  sort: StockSort
) {
  searchParams.set('sort', sort.key)
  searchParams.set('dir', sort.direction)
}
