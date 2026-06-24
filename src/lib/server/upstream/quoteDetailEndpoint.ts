import 'server-only'

function encodePathPart(value: string): string {
  return encodeURIComponent(value)
}

export function getQuoteDetailEndpoint(
  market: string,
  symbol: string
): string {
  return `/api/v2/${encodePathPart(market)}/Titulos/${encodePathPart(
    symbol
  )}/CotizacionDetalle`
}
