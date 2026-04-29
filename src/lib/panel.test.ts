import { describe, expect, it } from 'vitest'
import { normalizePanelData } from './panel'

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

  it('discards invalid items', () => {
    expect(
      normalizePanelData([
        { simbolo: '', descripcion: 'Missing ticker' },
        { simbolo: 'ALUA', descripcion: '' },
        { simbolo: 'COME', descripcion: 'Sociedad Comercial del Plata' },
      ])
    ).toEqual([
      {
        simbolo: 'COME',
        descripcion: 'Sociedad Comercial del Plata',
      },
    ])
  })

  it('throws when the upstream structure is invalid', () => {
    expect(() => normalizePanelData({ items: [] })).toThrow(
      'Invalid upstream payload structure'
    )
  })

  it('normalizes only finite numeric fields', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'PAMP',
          descripcion: 'Pampa Energia',
          ultimoPrecio: 123.45,
          variacionPorcentual: Number.NaN,
          apertura: Number.POSITIVE_INFINITY,
          maximo: 130,
          minimo: '120',
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

  it('normalizes puntas only when it has valid numbers', () => {
    expect(
      normalizePanelData([
        {
          simbolo: 'BMA',
          descripcion: 'Banco Macro',
          puntas: {
            cantidadCompra: 10,
            precioCompra: 'invalid',
            precioVenta: 250,
            cantidadVenta: Number.NaN,
          },
        },
        {
          simbolo: 'TRAN',
          descripcion: 'Transener',
          puntas: {
            cantidadCompra: 'invalid',
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
      {
        simbolo: 'TRAN',
        descripcion: 'Transener',
      },
    ])
  })
})
