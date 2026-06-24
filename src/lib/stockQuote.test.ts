import { describe, expect, it } from 'vitest'
import {
  buildStockQuoteApiPath,
  normalizeStockQuoteDetail,
} from './stockQuote'

describe('stockQuote', () => {
  it('normalizes CotizacionDetalle and preserves every depth row and zero', () => {
    const detail = normalizeStockQuoteDetail(
      {
        ultimoPrecio: 7615,
        variacion: -4.33,
        cierreAnterior: 7960,
        simbolo: 'GGAL',
        mercado: 'bcba',
        descripcionTitulo: 'Grupo Financiero Galicia S.A',
        montoOperado: 20190703365,
        cantidadOperaciones: 8864,
        puntas: [
          {
            cantidadCompra: 1,
            precioCompra: 7500,
            precioVenta: 8050,
            cantidadVenta: 85,
          },
          {
            cantidadCompra: 0,
            precioCompra: 0,
            precioVenta: 8540,
            cantidadVenta: 24,
          },
        ],
      },
      'GGAL'
    )

    expect(detail.previousClose).toBe(7960)
    expect(detail.amountTraded).toBe(20190703365)
    expect(detail.operationCount).toBe(8864)
    expect(detail.depth).toHaveLength(2)
    expect(detail.depth[1]).toMatchObject({
      buyQuantity: 0,
      buyPrice: 0,
    })
  })

  it('builds the internal BFF path', () => {
    expect(buildStockQuoteApiPath('GGAL')).toBe(
      '/api/stocks/GGAL/quote?market=bCBA'
    )
  })
})
