import { describe, expect, it } from 'vitest'
import { mapPanelTituloToStockProps } from './panelTitleToStock'

describe('mapPanelTituloToStockProps', () => {
  it('maps a suspicious repeated ultimoCierre to calculated previous close', () => {
    const stock = mapPanelTituloToStockProps({
      simbolo: 'GGAL',
      descripcion: 'Grupo Financiero Galicia',
      ultimoPrecio: 7615,
      variacionPorcentual: -4.33,
      ultimoCierre: 7615,
    })

    expect(stock.price).toBe(7615)
    expect(stock.close).toBeCloseTo(7959.65, 1)
  })

  it('keeps a valid explicit previous close', () => {
    const stock = mapPanelTituloToStockProps({
      simbolo: 'GGAL',
      descripcion: 'Grupo Financiero Galicia',
      ultimoPrecio: 7615,
      variacionPorcentual: -4.33,
      ultimoCierre: 7958,
    })

    expect(stock.close).toBe(7958)
  })
})
