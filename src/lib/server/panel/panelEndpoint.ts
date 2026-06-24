import 'server-only'

import type { MarketDataPanelKey } from '@/lib/market'
import { ENV } from '@/lib/server/core/env'

export function getPanelEndpoint(type: MarketDataPanelKey): string {
  switch (type) {
    case 'lider':
      return ENV.PANEL_LIDER_ENDPOINT
    case 'general':
      return ENV.PANEL_GENERAL_ENDPOINT
    case 'cedears':
      return ENV.PANEL_CEDEARS_ENDPOINT
  }
}
