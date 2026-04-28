export type MarketPanelKey = 'lider' | 'general' | 'cedears'

export const MARKET_PANEL_KEYS = ['lider', 'general', 'cedears'] as const

export function isMarketPanelKey(value: string | null): value is MarketPanelKey {
  return value === 'lider' || value === 'general' || value === 'cedears'
}