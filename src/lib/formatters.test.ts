import { describe, expect, it } from 'vitest'
import {
  formatInteger,
  formatMoney,
  formatNumber,
  formatSignedPercent,
} from './formatters'

describe('formatters', () => {
  it('formats finite numbers with es-AR decimals', () => {
    expect(formatNumber(1234.5)).toBe('1.234,50')
    expect(formatNumber(1234.567, 1)).toBe('1.234,6')
  })

  it('formats invalid values as an em dash', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('formats money with the peso prefix', () => {
    expect(formatMoney(98.7)).toBe('$ 98,70')
  })

  it('formats integers without decimals', () => {
    expect(formatInteger(1200.4)).toBe('1.200')
  })

  it('formats signed percentages with the existing sign spacing', () => {
    expect(formatSignedPercent(1.5)).toBe('+ 1,50%')
    expect(formatSignedPercent(-1.5)).toBe('- 1,50%')
    expect(formatSignedPercent(0)).toBe('0,00%')
    expect(formatSignedPercent(null)).toBe('—')
  })
})
