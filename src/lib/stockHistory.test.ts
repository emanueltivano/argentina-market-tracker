import { describe, expect, it } from 'vitest'
import {
  isStockHistoryRange,
  normalizeStockHistoryData,
  normalizeStockHistoryDataResult,
} from './stockHistory'

describe('stock history normalization', () => {
  it('normalizes known IOL-style field names into stable history points', () => {
    expect(
      normalizeStockHistoryData({
        cotizaciones: [
          {
            fecha: '2026-05-07T00:00:00',
            ultimoPrecio: 101,
            apertura: 98,
            maximo: 102,
            minimo: 97,
            volumen: 1000,
          },
        ],
      })
    ).toEqual([
      {
        date: '2026-05-07',
        close: 101,
        open: 98,
        high: 102,
        low: 97,
        volume: 1000,
      },
    ])
  })

  it('normalizes alternate CEDEAR-style price fields from IOL', () => {
    expect(
      normalizeStockHistoryData([
        {
          fechaCotizacion: '2026-05-07T00:00:00',
          precio: 916,
          precioApertura: 900,
          precioMaximo: 920,
          precioMinimo: 890,
          volumenNominal: 1500,
        },
      ])
    ).toEqual([
      {
        date: '2026-05-07',
        close: 916,
        open: 900,
        high: 920,
        low: 890,
        volume: 1500,
      },
    ])
  })

  it('normalizes CEDEAR rows with local date and numeric string values', () => {
    expect(
      normalizeStockHistoryData({
        Data: [
          {
            Fecha: '07/05/2026',
            PrecioAjustado: '1.234,56',
            PrecioApertura: '1.200,00',
            PrecioMaximo: '1.250,10',
            PrecioMinimo: '1.190,50',
            VolumenNominal: '1.500',
          },
        ],
      })
    ).toEqual([
      {
        date: '2026-05-07',
        close: 1234.56,
        open: 1200,
        high: 1250.1,
        low: 1190.5,
        volume: 1500,
      },
    ])
  })

  it('matches history field names case-insensitively without changing actions', () => {
    expect(
      normalizeStockHistoryData([
        {
          FECHA_HORA: '2026-05-07T00:00:00',
          ULTIMO_PRECIO: '101,25',
          APERTURA: '98,00',
          MAXIMO: '102,50',
          MINIMO: '97,75',
          VOLUMEN: '2,000',
        },
      ])
    ).toEqual([
      {
        date: '2026-05-07',
        close: 101.25,
        open: 98,
        high: 102.5,
        low: 97.75,
        volume: 2000,
      },
    ])
  })

  it('filters partially invalid rows and keeps valid history points', () => {
    expect(
      normalizeStockHistoryDataResult([
        { fecha: 'invalid', ultimoPrecio: 100 },
        { fecha: '2026-05-07', ultimoPrecio: 101 },
      ])
    ).toEqual({
      data: [{ date: '2026-05-07', close: 101 }],
      discardedPoints: 1,
      totalPoints: 2,
    })
  })

  it('throws when no valid history item remains', () => {
    expect(() => normalizeStockHistoryData([{ fecha: 'invalid' }])).toThrow(
      'Upstream history payload contains no valid items'
    )
  })

  it('throws when a row is missing required fields', () => {
    expect(() =>
      normalizeStockHistoryData([{ ultimoPrecio: 101 }])
    ).toThrow('Upstream history payload contains no valid items')
  })

  it('throws when a payload has incorrect required field types', () => {
    expect(() =>
      normalizeStockHistoryData([{ fecha: '2026-05-07', ultimoPrecio: {} }])
    ).toThrow('Upstream history payload contains no valid items')
  })

  it('keeps ranges explicit', () => {
    expect(isStockHistoryRange('1M')).toBe(true)
    expect(isStockHistoryRange('2Y')).toBe(false)
  })
})
