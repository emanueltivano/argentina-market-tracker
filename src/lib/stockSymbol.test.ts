import { describe, expect, it } from 'vitest'
import {
  isStockSymbol,
  normalizeStockSymbol,
  parseStockSymbolParam,
} from './stockSymbol'

describe('stockSymbol', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeStockSymbol('  ggal ')).toBe('GGAL')
  })

  it('decodes and validates route parameters', () => {
    expect(parseStockSymbolParam('%20alua%20')).toBe('ALUA')
    expect(parseStockSymbolParam('BRK.B')).toBe('BRK.B')
  })

  it('rejects malformed encodings and unsupported characters', () => {
    expect(parseStockSymbolParam('%E0%A4%A')).toBeNull()
    expect(parseStockSymbolParam('bad symbol!')).toBeNull()
    expect(isStockSymbol('')).toBe(false)
    expect(isStockSymbol('A'.repeat(21))).toBe(false)
  })
})
