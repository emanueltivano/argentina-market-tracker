import { describe, expect, it } from 'vitest'
import {
  formatCurrencyARS,
  formatDateTick,
  formatDateTimeAR,
  formatInteger,
  formatMoney,
  formatNumber,
  formatPercentage,
  formatQuantity,
  formatSignedPercent,
  normalizeCurrency,
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
    expect(formatQuantity(0)).toBe('0')
    expect(formatQuantity(null)).toBe('—')
  })

  it('formats signed percentages without arrows or sign spacing', () => {
    expect(formatSignedPercent(1.5)).toBe('+1,50%')
    expect(formatSignedPercent(-1.5)).toBe('-1,50%')
    expect(formatSignedPercent(0)).toBe('0,00%')
    expect(formatSignedPercent(null)).toBe('—')
  })

  it('formats stock detail values using the Argentina conventions', () => {
    expect(formatCurrencyARS(1028)).toBe('$ 1.028,00')
    expect(formatCurrencyARS(0)).toBe('$ 0,00')
    expect(formatCurrencyARS(0, { zeroIsMissing: true })).toBe('—')
    expect(formatPercentage(6.25)).toBe('+6,25%')
    expect(formatPercentage(-0.48)).toBe('-0,48%')
    expect(formatPercentage(0)).toBe('0,00%')
    expect(normalizeCurrency('peso_Argentino')).toBe('ARS')
  })

  it('formats chart ticks without repeating the year and timestamps in Argentina time', () => {
    expect(formatDateTick('2026-06-24')).toBe('24/06')
    expect(formatDateTimeAR('2026-06-24T20:39:47.208Z')).toContain(
      '24/6/26'
    )
  })
})
