import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STOCK_SORT,
  type StockSort,
} from '../lib/stockSorting'
import {
  parseStoredStockSort,
  resolveInitialStockSort,
  serializeStockSort,
  setStockSortSearchParams,
  STOCK_SORT_STORAGE_KEY,
} from '../lib/stockSortPersistence'

const VAR_DESC: StockSort = { key: 'var', direction: 'desc' }
const PRICE_ASC: StockSort = { key: 'price', direction: 'asc' }

function searchParams(value = '') {
  return new URLSearchParams(value)
}

describe('stockSortPersistence', () => {
  it('resolves valid query params before stored preferences', () => {
    expect(
      resolveInitialStockSort(
        searchParams('sort=var&dir=desc'),
        serializeStockSort(PRICE_ASC)
      )
    ).toEqual(VAR_DESC)
  })

  it('falls back to default when query params are invalid', () => {
    expect(
      resolveInitialStockSort(
        searchParams('sort=unknown&dir=desc'),
        serializeStockSort(PRICE_ASC)
      )
    ).toEqual(DEFAULT_STOCK_SORT)
  })

  it('uses stored preferences when query params are absent', () => {
    expect(resolveInitialStockSort(searchParams(), serializeStockSort(PRICE_ASC))).toEqual(
      PRICE_ASC
    )
  })

  it('falls back to default when stored preferences are invalid', () => {
    expect(resolveInitialStockSort(searchParams(), '{"key":"var"}')).toEqual(
      DEFAULT_STOCK_SORT
    )
    expect(parseStoredStockSort('not-json')).toBeNull()
  })

  it('writes sort params with the expected names', () => {
    const params = searchParams('panel=lider')

    setStockSortSearchParams(params, VAR_DESC)

    expect(params.toString()).toBe('panel=lider&sort=var&dir=desc')
    expect(STOCK_SORT_STORAGE_KEY).toContain('stock-sort')
  })
})
