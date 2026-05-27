import { describe, expect, it } from 'vitest'
import { getQuoteEndpoint, normalizeQuoteMarket } from './quoteEndpoint'

describe('quoteEndpoint', () => {
  it('builds the expected individual quote endpoint path', () => {
    expect(getQuoteEndpoint('bCBA', 'GGAL')).toBe(
      '/api/v2/bCBA/Titulos/GGAL/Cotizacion'
    )
  })

  it('normalizes BCBA market casing to the canonical path format', () => {
    expect(normalizeQuoteMarket('BCBA')).toBe('bCBA')
    expect(normalizeQuoteMarket('bcba')).toBe('bCBA')
    expect(getQuoteEndpoint('BCBA', 'ALUA')).toBe(
      '/api/v2/bCBA/Titulos/ALUA/Cotizacion'
    )
  })
})
