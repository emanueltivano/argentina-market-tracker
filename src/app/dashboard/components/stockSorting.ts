import { type StockData } from './Stock'

export type StockSortKey = 'ticker' | 'price' | 'var' | 'volume'
export type StockSortDirection = 'asc' | 'desc'

export type StockSort = {
  key: StockSortKey
  direction: StockSortDirection
}

export const DEFAULT_STOCK_SORT: StockSort = {
  key: 'ticker',
  direction: 'asc',
}

const FIRST_SORT_DIRECTION: Record<StockSortKey, StockSortDirection> = {
  ticker: 'asc',
  price: 'desc',
  var: 'desc',
  volume: 'desc',
}

function reverseDirection(direction: StockSortDirection): StockSortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

export function getNextStockSort(
  currentSort: StockSort,
  key: StockSortKey
): StockSort {
  if (currentSort.key !== key) {
    return {
      key,
      direction: FIRST_SORT_DIRECTION[key],
    }
  }

  return {
    key,
    direction: reverseDirection(currentSort.direction),
  }
}

function getNumericValue(stock: StockData, key: StockSortKey): number | null {
  if (key === 'ticker') {
    return null
  }

  const value = stock[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function compareTicker(a: StockData, b: StockData): number {
  const left = a.ticker.trim()
  const right = b.ticker.trim()

  if (left === '' && right === '') return 0
  if (left === '') return 1
  if (right === '') return -1

  return left.localeCompare(right, 'es-AR', { sensitivity: 'base' })
}

function compareNumber(
  a: StockData,
  b: StockData,
  sort: StockSort
): number {
  const left = getNumericValue(a, sort.key)
  const right = getNumericValue(b, sort.key)

  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  return sort.direction === 'asc' ? left - right : right - left
}

function compareStocks(a: StockData, b: StockData, sort: StockSort): number {
  const result =
    sort.key === 'ticker' ? compareTicker(a, b) : compareNumber(a, b, sort)

  return sort.direction === 'desc' && sort.key === 'ticker' ? -result : result
}

export function sortStocks(rows: readonly StockData[], sort: StockSort) {
  return rows
    .map((stock, index) => ({ stock, index }))
    .sort((left, right) => {
      const result = compareStocks(left.stock, right.stock, sort)

      return result === 0 ? left.index - right.index : result
    })
    .map(({ stock }) => stock)
}
