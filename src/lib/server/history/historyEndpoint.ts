import 'server-only'

import { type StockHistoryRange } from '@/lib/stockHistory'

export type HistoryVariant = 'ajustada' | 'sinAjustar'

const RANGE_DAYS: Record<StockHistoryRange, number> = {
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 365,
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateRange(range: StockHistoryRange, now = new Date()) {
  const fechaHasta = toDateInput(now)
  const desde = new Date(now)

  desde.setUTCDate(desde.getUTCDate() - RANGE_DAYS[range])

  return {
    fechaDesde: toDateInput(desde),
    fechaHasta,
  }
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value)
}

export function getHistoryEndpoint(
  market: string,
  symbol: string,
  range: StockHistoryRange,
  variant: HistoryVariant
): string {
  const { fechaDesde, fechaHasta } = getDateRange(range)

  return `/api/v2/${encodePathPart(market)}/Titulos/${encodePathPart(
    symbol
  )}/Cotizacion/seriehistorica/${fechaDesde}/${fechaHasta}/${variant}`
}
