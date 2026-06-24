import 'server-only'

import type { NextRequest } from 'next/server'
import type { MarketDataPanelKey } from '@/lib/market'
import {
  checkRateLimit,
  clearRateLimitStateForTests,
  type MaybePromise,
  type RateLimitCheckResult,
  type RateLimitPolicy,
} from '@/lib/server/core/rateLimit'

const PANEL_RATE_LIMIT_POLICY: RateLimitPolicy = {
  namespace: 'panel',
  limit: 120,
  windowMs: 60_000,
  maxKeys: 1_000,
}

const PANEL_REFRESH_COOLDOWN_POLICY: RateLimitPolicy = {
  namespace: 'panel-refresh',
  limit: 1,
  windowMs: 15_000,
  maxKeys: 1_000,
}

export function checkPanelRateLimit(
  req: NextRequest
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimit(req, PANEL_RATE_LIMIT_POLICY, 'default')
}

export function checkPanelRefreshCooldown(
  req: NextRequest,
  type: MarketDataPanelKey
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimit(req, PANEL_REFRESH_COOLDOWN_POLICY, type)
}

export function clearPanelLimitsForTests() {
  clearRateLimitStateForTests()
}
