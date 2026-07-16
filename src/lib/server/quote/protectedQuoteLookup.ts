import 'server-only'

import {
  getRetryAfterHeaders,
  safeCheckRateLimit,
  type RateLimitIdentity,
} from '@/lib/server/core/rateLimit'
import { checkQuoteUpstreamBudget } from '@/lib/server/quote/quoteRateLimit'
import type { StockHistoryMarket } from '@/lib/stockHistory'

export type ProtectedQuoteLookupContext = {
  rateLimitIdentity: RateLimitIdentity
  requestId?: string
  route: string
}

export class QuoteUpstreamBudgetError extends Error {
  constructor(
    public readonly code: 'RATE_LIMITED' | 'RATE_LIMIT_UNAVAILABLE',
    public readonly status: 429 | 503,
    public readonly headers: Record<string, string>
  ) {
    super(code)
    this.name = 'QuoteUpstreamBudgetError'
  }
}

export async function executeProtectedQuoteLookup<T>(options: {
  context: ProtectedQuoteLookupContext
  lookup: () => Promise<T>
  market: StockHistoryMarket
  symbol: string
}): Promise<T> {
  const budgetCheck = await safeCheckRateLimit(
    () => checkQuoteUpstreamBudget(options.context.rateLimitIdentity),
    {
      requestId: options.context.requestId,
      route: options.context.route,
    }
  )

  if (!budgetCheck.ok) {
    throw new QuoteUpstreamBudgetError(
      'RATE_LIMIT_UNAVAILABLE',
      budgetCheck.status,
      { 'Retry-After': String(budgetCheck.retryAfterSec) }
    )
  }

  if (!budgetCheck.rateLimit.ok) {
    throw new QuoteUpstreamBudgetError(
      'RATE_LIMITED',
      429,
      getRetryAfterHeaders(budgetCheck.rateLimit)
    )
  }

  return options.lookup()
}
