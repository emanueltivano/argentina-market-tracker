import 'server-only'

function encodePathPart(value: string): string {
  return encodeURIComponent(value)
}

export function normalizeQuoteMarket(market: string): string {
  const trimmedMarket = market.trim()

  return trimmedMarket.toLowerCase() === 'bcba' ? 'bCBA' : trimmedMarket
}

export function getQuoteEndpoint(market: string, symbol: string): string {
  return `/api/v2/${encodePathPart(normalizeQuoteMarket(market))}/Titulos/${encodePathPart(
    symbol
  )}/Cotizacion`
}
