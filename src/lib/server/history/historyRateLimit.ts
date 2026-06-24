import 'server-only'

import type { NextRequest } from 'next/server'
import {
  checkRateLimit,
  clearRateLimitStateForTests,
  type MaybePromise,
  type RateLimitCheckResult,
  type RateLimitPolicy,
} from '@/lib/server/core/rateLimit'

const HISTORY_RATE_LIMIT_POLICY: RateLimitPolicy = {
  namespace: 'history',
  limit: 120,
  windowMs: 60_000,
  maxKeys: 1_000,
}

export function checkHistoryRateLimit(
  req: NextRequest
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimit(req, HISTORY_RATE_LIMIT_POLICY, 'default')
}

export function clearHistoryRateLimitForTests() {
  clearRateLimitStateForTests()
}
