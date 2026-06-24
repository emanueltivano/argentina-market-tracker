import { type PanelTitulo } from '@/lib/panel'
import { type StockData } from '@/features/dashboard/shared/stockData'
import { resolvePreviousClose } from '@/features/dashboard/shared/stockQuoteMetrics'

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getVariationType(value: number | null): StockData['varType'] {
  if (value === null || value === 0) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

export function mapPanelTituloToStockProps(
  item: PanelTitulo,
  fallbackQuoteDate?: string
): StockData {
  const variation = numberOrNull(item.variacionPorcentual)
  const price = numberOrNull(item.ultimoPrecio)

  return {
    ticker: item.simbolo,
    description: item.descripcion,
    price,
    var: variation,
    varType: getVariationType(variation),
    buyQty: numberOrNull(item.puntas?.cantidadCompra),
    buyPrice: numberOrNull(item.puntas?.precioCompra),
    sellPrice: numberOrNull(item.puntas?.precioVenta),
    sellQty: numberOrNull(item.puntas?.cantidadVenta),
    open: numberOrNull(item.apertura),
    min: numberOrNull(item.minimo),
    max: numberOrNull(item.maximo),
    close: resolvePreviousClose({
      currentPrice: price,
      variation,
      explicitPreviousClose: numberOrNull(item.ultimoCierre),
    }),
    volume: numberOrNull(item.volumen),
    quoteDate: item.fechaHora ?? fallbackQuoteDate ?? null,
    amountTraded: numberOrNull(item.montoOperado),
    operationCount: numberOrNull(item.cantidadOperaciones),
    currency: item.moneda ?? null,
    settlement: item.plazo ?? null,
    minimumSheet: numberOrNull(item.laminaMinima),
    lot: numberOrNull(item.lote),
  }
}
