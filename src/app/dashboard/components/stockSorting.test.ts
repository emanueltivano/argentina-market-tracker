import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STOCK_SORT,
  getNextStockSort,
  sortStocks,
  type StockSort,
} from './stockSorting'
import { type StockData } from './Stock'

function stock(overrides: Partial<StockData> & Pick<StockData, 'ticker'>): StockData {
  return {
    ticker: overrides.ticker,
    description: overrides.description ?? overrides.ticker,
    price: overrides.price ?? null,
    var: overrides.var ?? null,
    varType: overrides.varType ?? 'neutral',
    buyQty: overrides.buyQty ?? null,
    buyPrice: overrides.buyPrice ?? null,
    sellPrice: overrides.sellPrice ?? null,
    sellQty: overrides.sellQty ?? null,
    open: overrides.open ?? null,
    min: overrides.min ?? null,
    max: overrides.max ?? null,
    close: overrides.close ?? null,
    volume: overrides.volume ?? null,
  }
}

function tickers(rows: readonly StockData[]) {
  return rows.map((row) => row.ticker)
}

describe('stockSorting', () => {
  it('sorts by ticker ascending by default', () => {
    const rows = [stock({ ticker: 'YPFD' }), stock({ ticker: 'ALUA' }), stock({ ticker: 'GGAL' })]

    expect(tickers(sortStocks(rows, DEFAULT_STOCK_SORT))).toEqual([
      'ALUA',
      'GGAL',
      'YPFD',
    ])
  })

  it('sorts by Var % descending on first click', () => {
    const rows = [
      stock({ ticker: 'BAJA', var: -3 }),
      stock({ ticker: 'SUBA', var: 4 }),
      stock({ ticker: 'NEUTRAL', var: 0 }),
    ]
    const sort = getNextStockSort(DEFAULT_STOCK_SORT, 'var')

    expect(sort).toEqual({ key: 'var', direction: 'desc' })
    expect(tickers(sortStocks(rows, sort))).toEqual(['SUBA', 'NEUTRAL', 'BAJA'])
  })

  it('sorts by Var % ascending on second click', () => {
    const rows = [
      stock({ ticker: 'BAJA', var: -3 }),
      stock({ ticker: 'SUBA', var: 4 }),
      stock({ ticker: 'NEUTRAL', var: 0 }),
    ]
    const firstSort = getNextStockSort(DEFAULT_STOCK_SORT, 'var')
    const secondSort = getNextStockSort(firstSort, 'var')

    expect(secondSort).toEqual({ key: 'var', direction: 'asc' })
    expect(tickers(sortStocks(rows, secondSort))).toEqual(['BAJA', 'NEUTRAL', 'SUBA'])
  })

  it('keeps empty or invalid numeric values at the end', () => {
    const rows = [
      stock({ ticker: 'NULL', var: null }),
      stock({ ticker: 'VALID', var: 2 }),
      stock({ ticker: 'NAN', var: Number.NaN }),
      stock({ ticker: 'STRING', var: 'no-number' as unknown as number }),
      stock({ ticker: 'LOW', var: -1 }),
    ]
    const descendingSort: StockSort = { key: 'var', direction: 'desc' }
    const ascendingSort: StockSort = { key: 'var', direction: 'asc' }

    expect(tickers(sortStocks(rows, descendingSort))).toEqual([
      'VALID',
      'LOW',
      'NULL',
      'NAN',
      'STRING',
    ])
    expect(tickers(sortStocks(rows, ascendingSort))).toEqual([
      'LOW',
      'VALID',
      'NULL',
      'NAN',
      'STRING',
    ])
  })

  it('compares price and volume as numbers', () => {
    const rows = [
      stock({ ticker: 'LOW', price: 9, volume: 200 }),
      stock({ ticker: 'HIGH', price: 100, volume: 50 }),
      stock({ ticker: 'MID', price: 20, volume: 1000 }),
    ]

    expect(tickers(sortStocks(rows, { key: 'price', direction: 'asc' }))).toEqual([
      'LOW',
      'MID',
      'HIGH',
    ])
    expect(tickers(sortStocks(rows, { key: 'volume', direction: 'desc' }))).toEqual([
      'MID',
      'LOW',
      'HIGH',
    ])
  })

  it('does not mutate the original data', () => {
    const rows = [stock({ ticker: 'YPFD' }), stock({ ticker: 'ALUA' }), stock({ ticker: 'GGAL' })]
    const originalOrder = tickers(rows)
    const sortedRows = sortStocks(rows, DEFAULT_STOCK_SORT)

    expect(tickers(rows)).toEqual(originalOrder)
    expect(sortedRows).not.toBe(rows)
  })
})
