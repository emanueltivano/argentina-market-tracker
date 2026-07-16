const STOCK_SYMBOL_PATTERN = /^[A-Z0-9._-]{1,20}$/

export function normalizeStockSymbol(value: string): string {
  return value.trim().toUpperCase()
}

export function isStockSymbol(value: string): boolean {
  return STOCK_SYMBOL_PATTERN.test(value)
}

export function parseStockSymbolParam(value: string): string | null {
  try {
    const symbol = normalizeStockSymbol(decodeURIComponent(value))

    return isStockSymbol(symbol) ? symbol : null
  } catch {
    return null
  }
}
