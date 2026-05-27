import 'server-only'

import type { NextRequest } from 'next/server'
import {
  checkRateLimit,
  clearRateLimitStateForTests,
  type MaybePromise,
  type RateLimitCheckResult,
  type RateLimitPolicy,
} from './rateLimit'

const FAVORITES_RATE_LIMIT_POLICY: RateLimitPolicy = {
  namespace: 'favorites',
  limit: 120,
  windowMs: 60_000,
  maxKeys: 1_000,
}

export function checkFavoritesRateLimit(
  req: NextRequest
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimit(req, FAVORITES_RATE_LIMIT_POLICY, 'default')
}

export function clearFavoritesRateLimitForTests() {
  clearRateLimitStateForTests()
}
