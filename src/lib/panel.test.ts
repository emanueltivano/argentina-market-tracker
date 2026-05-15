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

  it('throws when a non-empty payload mixes valid and invalid items', () => {
    expect(() =>
      normalizePanelData([
        { simbolo: '', descripcion: 'Missing ticker' },
        { simbolo: 'COME', descripcion: 'Sociedad Comercial del Plata' },
      ])
    ).toThrow('Upstream payload contains partially invalid items')
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

  it('throws when a payload mixes valid rows with invalid nested puntas types', () => {
    expect(() =>
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
    ).toThrow('Upstream payload contains partially invalid items')
  })
})
