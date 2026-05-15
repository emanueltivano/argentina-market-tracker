export type MarketDataPanelKey = 'lider' | 'general' | 'cedears'
export type MarketPanelKey = MarketDataPanelKey | 'favorites'

export const MARKET_DATA_PANEL_KEYS = ['lider', 'general', 'cedears'] as const
export const MARKET_PANEL_KEYS = [...MARKET_DATA_PANEL_KEYS, 'favorites'] as const

export function buildMarketPanelApiPath(type: MarketDataPanelKey): string {
  return `/api/panel?type=${type}`
}

export function isMarketPanelKey(value: string | null): value is MarketPanelKey {
  return (
    typeof value === 'string' &&
    MARKET_PANEL_KEYS.includes(value as MarketPanelKey)
  )
}

export function isMarketDataPanelKey(
  value: string | null
): value is MarketDataPanelKey {
  return (
    typeof value === 'string' &&
    MARKET_DATA_PANEL_KEYS.includes(value as MarketDataPanelKey)
  )
}
