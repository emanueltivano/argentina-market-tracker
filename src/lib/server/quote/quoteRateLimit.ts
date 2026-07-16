import 'server-only'

import {
  checkRateLimitForIdentity,
  clearRateLimitStateForTests,
  type MaybePromise,
  type RateLimitIdentity,
  type RateLimitCheckResult,
  type RateLimitPolicy,
} from '@/lib/server/core/rateLimit'

const QUOTE_PUBLIC_REQUEST_RATE_LIMIT_POLICY: RateLimitPolicy = {
  namespace: 'quote-public',
  limit: 120,
  windowMs: 60_000,
  maxKeys: 1_000,
}

const QUOTE_UPSTREAM_BUDGET_POLICY: RateLimitPolicy = {
  namespace: 'quote-upstream',
  limit: 120,
  windowMs: 60_000,
  maxKeys: 1_000,
}

export function checkQuotePublicRequestRateLimit(
  identity: RateLimitIdentity
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimitForIdentity(
    identity,
    QUOTE_PUBLIC_REQUEST_RATE_LIMIT_POLICY,
    'default'
  )
}

export function checkQuoteUpstreamBudget(
  identity: RateLimitIdentity
): MaybePromise<RateLimitCheckResult> {
  return checkRateLimitForIdentity(
    identity,
    QUOTE_UPSTREAM_BUDGET_POLICY,
    'provider-call'
  )
}

export function clearQuoteRateLimitForTests() {
  clearRateLimitStateForTests()
}
