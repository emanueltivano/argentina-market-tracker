import { describe, expect, it } from 'vitest'
import { getQuoteDetailEndpoint } from './quoteDetailEndpoint'

describe('quoteDetailEndpoint', () => {
  it('builds the CotizacionDetalle endpoint', () => {
    expect(getQuoteDetailEndpoint('bCBA', 'GGAL')).toBe(
      '/api/v2/bCBA/Titulos/GGAL/CotizacionDetalle'
    )
  })
})
