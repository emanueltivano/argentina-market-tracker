import { describe, expect, it } from 'vitest'
import {
  normalizePanelData,
  normalizePanelDataResult,
  normalizeQuoteData,
} from './panel'

describe('normalizePanelData', () => {
  it('accepts a direct array payload', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'GGAL',
          descripcion: 'Grupo Financiero Galicia',
        },
      ])
    ).toEqual([
      {
        simbolo: 'GGAL',
        descripcion: 'Grupo Financiero Galicia',
      },
    ])
  })

  it('accepts a payload with titulos', () => {
    expect(
      normalizePanelData({
        titulos: [
          {
            simbolo: 'YPFD',
            descripcion: 'YPF',
          },
        ],
      })
    ).toEqual([
      {
        simbolo: 'YPFD',
        descripcion: 'YPF',
      },
    ])
  })

  it('accepts a payload with data', () => {
    expect(
      normalizePanelData({
        data: [
          {
            simbolo: 'MIRG',
            descripcion: 'Mirgor',
          },
        ],
      })
    ).toEqual([
      {
        simbolo: 'MIRG',
        descripcion: 'Mirgor',
      },
    ])
  })

  it('accepts an empty payload as no results', () => {
    expect(normalizePanelData([])).toEqual([])
    expect(normalizePanelData({ data: [] })).toEqual([])
  })

  it('keeps valid rows when a non-empty payload mixes valid and invalid items', () => {
    expect(
      normalizePanelData([
        { simbolo: '', descripcion: 'Missing ticker' },
        { simbolo: 'COME', descripcion: 'Sociedad Comercial del Plata' },
      ])
    ).toEqual([
      {
        simbolo: 'COME',
        descripcion: 'Sociedad Comercial del Plata',
      },
    ])
  })

  it('returns partial normalization metadata for mixed valid and invalid items', () => {
    expect(
      normalizePanelDataResult([
        { simbolo: '', descripcion: 'Missing ticker' },
        { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
        {
          simbolo: 'PAMP',
          descripcion: 'Pampa Energia',
          ultimoPrecio: '123.45',
        },
      ])
    ).toEqual({
      data: [
        {
          simbolo: 'GGAL',
          descripcion: 'Grupo Financiero Galicia',
        },
      ],
      droppedItemsCount: 2,
      droppedItemsSummary: [
        { reason: 'INVALID_IDENTITY:1' },
        { reason: 'INVALID_NUMERIC_FIELD:ultimoPrecio:1' },
      ],
    })
  })

  it('throws when a row has missing required fields', () => {
    expect(() =>
      normalizePanelData([
        { simbolo: 'ALUA' },
      ])
    ).toThrow('Upstream payload contains no valid items')
  })

  it('throws when the upstream structure is invalid', () => {
    expect(() => normalizePanelData({ items: [] })).toThrow(
      'Invalid upstream payload structure'
    )
  })

  it('throws when a non-empty payload has no valid items', () => {
    expect(() =>
      normalizePanelData([
        { simbolo: '', descripcion: 'Missing ticker' },
        { simbolo: 'ALUA', descripcion: '' },
      ])
    ).toThrow('Upstream payload contains no valid items')
  })

  it('keeps optional numeric fields missing without failing the row', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'PAMP',
          descripcion: 'Pampa Energia',
          ultimoPrecio: 123.45,
          maximo: 130,
          ultimoCierre: 122,
          volumen: 1000,
        },
      ])
    ).toEqual([
      {
        simbolo: 'PAMP',
        descripcion: 'Pampa Energia',
        ultimoPrecio: 123.45,
        maximo: 130,
        ultimoCierre: 122,
        volumen: 1000,
      },
    ])
  })

  it('throws when a valid row contains invalid numeric field types', () => {
    expect(() =>
      normalizePanelData([
        {
          simbolo: 'PAMP',
          descripcion: 'Pampa Energia',
          ultimoPrecio: '123.45',
        },
      ])
    ).toThrow('Upstream payload contains no valid items')
  })

  it('normalizes puntas when their numeric fields are valid', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'BMA',
          descripcion: 'Banco Macro',
          puntas: {
            cantidadCompra: 10,
            precioVenta: 250,
          },
        },
      ])
    ).toEqual([
      {
        simbolo: 'BMA',
        descripcion: 'Banco Macro',
        puntas: {
          cantidadCompra: 10,
          precioVenta: 250,
        },
      },
    ])
  })

  it('drops invalid nested puntas rows while keeping valid rows', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'BMA',
          descripcion: 'Banco Macro',
          puntas: 'invalid',
        },
        {
          simbolo: 'GGAL',
          descripcion: 'Grupo Financiero Galicia',
        },
      ])
    ).toEqual([
      {
        simbolo: 'GGAL',
        descripcion: 'Grupo Financiero Galicia',
      },
    ])
  })

  it('normalizes the individual quote payload shape returned by IOL', () => {
    expect(
      normalizeQuoteData(
        {
          ultimoPrecio: 967.5,
          variacion: 3.09,
          apertura: 948,
          maximo: 970.5,
          minimo: 920,
          cierreAnterior: 938.5,
          volumenNominal: 407493,
          descripcionTitulo: 'Aluar',
          puntas: [
            {
              cantidadCompra: 18,
              precioCompra: 907.5,
              precioVenta: 974.5,
              cantidadVenta: 6,
            },
          ],
        },
        {
          symbol: 'ALUA',
        }
      )
    ).toEqual({
      simbolo: 'ALUA',
      descripcion: 'Aluar',
      ultimoPrecio: 967.5,
      variacionPorcentual: 3.09,
      apertura: 948,
      maximo: 970.5,
      minimo: 920,
      ultimoCierre: 938.5,
      volumen: 407493,
      puntas: {
        cantidadCompra: 18,
        precioCompra: 907.5,
        precioVenta: 974.5,
        cantidadVenta: 6,
      },
    })
  })

  it('throws when an individual quote payload is missing a usable description', () => {
    expect(() =>
      normalizeQuoteData(
        {
          ultimoPrecio: 100,
        },
        {
          symbol: 'GGAL',
        }
      )
    ).toThrow('Upstream quote payload contains no valid item')
  })
})
