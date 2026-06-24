import { describe, expect, it } from 'vitest'
import { resolvePreviousClose } from './stockQuoteMetrics'

describe('resolvePreviousClose', () => {
  it('calculates previous close from current price and variation', () => {
    expect(
      resolvePreviousClose({
        currentPrice: 7615,
        variation: -4.33,
        explicitPreviousClose: null,
      })
    ).toBeCloseTo(7959.65, 1)
  })

  it('prioritizes a valid explicit previous close', () => {
    expect(
      resolvePreviousClose({
        currentPrice: 7615,
        variation: -4.33,
        explicitPreviousClose: 7958,
        historicalPreviousClose: 7900,
      })
    ).toBe(7958)
  })

  it('rejects an explicit close equal to current price when variation is non-zero', () => {
    expect(
      resolvePreviousClose({
        currentPrice: 7615,
        variation: -4.33,
        explicitPreviousClose: 7615,
        historicalPreviousClose: 7900,
      })
    ).toBeCloseTo(7959.65, 1)
  })

  it('allows previous close to equal current price when variation is zero', () => {
    expect(
      resolvePreviousClose({
        currentPrice: 7615,
        variation: 0,
        explicitPreviousClose: 7615,
      })
    ).toBe(7615)
  })

  it('uses historical fallback when price or variation cannot calculate it', () => {
    expect(
      resolvePreviousClose({
        currentPrice: 7615,
        variation: null,
        explicitPreviousClose: null,
        historicalPreviousClose: 7900,
      })
    ).toBe(7900)
  })
})
