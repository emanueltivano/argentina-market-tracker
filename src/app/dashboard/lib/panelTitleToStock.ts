import { type PanelTitulo } from '@/lib/panel'
import { type StockData } from './stockData'

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getVariationType(value: number | null): StockData['varType'] {
  if (value === null || value === 0) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

export function mapPanelTituloToStockProps(item: PanelTitulo): StockData {
  const variation = numberOrNull(item.variacionPorcentual)

  return {
    ticker: item.simbolo,
    description: item.descripcion,
    price: numberOrNull(item.ultimoPrecio),
    var: variation,
    varType: getVariationType(variation),
    buyQty: numberOrNull(item.puntas?.cantidadCompra),
    buyPrice: numberOrNull(item.puntas?.precioCompra),
    sellPrice: numberOrNull(item.puntas?.precioVenta),
    sellQty: numberOrNull(item.puntas?.cantidadVenta),
    open: numberOrNull(item.apertura),
    min: numberOrNull(item.minimo),
    max: numberOrNull(item.maximo),
    close: numberOrNull(item.ultimoCierre),
    volume: numberOrNull(item.volumen),
    quoteDate: item.fechaHora ?? null,
  }
}
