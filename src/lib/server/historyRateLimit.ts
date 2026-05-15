import 'server-only'

import { type NextRequest } from 'next/server'

const HISTORY_RATE_LIMIT_WINDOW_MS = 60_000
const HISTORY_RATE_LIMIT_MAX_REQUESTS = 120
const HISTORY_RATE_LIMIT_MAX_KEYS = 1_000

type RateLimitEntry = {
  count: number
  resetAt: number
}

const historyRateLimitStore = new Map<string, RateLimitEntry>()

function getClientKey(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()

  return forwardedFor || realIp || 'local'
}

function pruneRateLimitStore(now: number) {
  for (const [key, entry] of historyRateLimitStore) {
    if (now >= entry.resetAt) {
      historyRateLimitStore.delete(key)
    }
  }

  if (historyRateLimitStore.size <= HISTORY_RATE_LIMIT_MAX_KEYS) {
    return
  }

  const entriesByOldestReset = [...historyRateLimitStore.entries()].sort(
    ([, first], [, second]) => first.resetAt - second.resetAt
  )

  for (const [key] of entriesByOldestReset.slice(
    0,
    historyRateLimitStore.size - HISTORY_RATE_LIMIT_MAX_KEYS
  )) {
    historyRateLimitStore.delete(key)
  }
}

export function checkHistoryRateLimit(
  req: NextRequest
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  pruneRateLimitStore(now)

  const key = getClientKey(req)
  const current = historyRateLimitStore.get(key)

  if (!current || now >= current.resetAt) {
    historyRateLimitStore.set(key, {
      count: 1,
      resetAt: now + HISTORY_RATE_LIMIT_WINDOW_MS,
    })

    return { ok: true }
  }

  if (current.count >= HISTORY_RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    }
  }

  current.count += 1
  return { ok: true }
}
