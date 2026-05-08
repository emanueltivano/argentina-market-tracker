import 'server-only'

import type { NextRequest } from 'next/server'
import type { MarketDataPanelKey } from '@/lib/market'

const PANEL_RATE_LIMIT_WINDOW_MS = 60_000
const PANEL_RATE_LIMIT_MAX_REQUESTS = 120
const PANEL_RATE_LIMIT_MAX_KEYS = 1_000
const PANEL_REFRESH_COOLDOWN_MS = 15_000
const PANEL_REFRESH_COOLDOWN_MAX_KEYS = 1_000

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RefreshCooldownEntry = {
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const refreshCooldownStore = new Map<string, RefreshCooldownEntry>()

function getClientKey(req: NextRequest): string {
  // MVP/portfolio protection only. In production behind multiple instances,
  // move this to Redis/KV/WAF and trust IP headers only from the edge proxy.
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()

  return forwardedFor || realIp || 'local'
}

function pruneStore<T extends { resetAt: number }>(
  store: Map<string, T>,
  now: number,
  maxKeys: number
) {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }

  if (store.size <= maxKeys) {
    return
  }

  const entriesByOldestReset = [...store.entries()].sort(
    ([, first], [, second]) => first.resetAt - second.resetAt
  )

  for (const [key] of entriesByOldestReset.slice(0, store.size - maxKeys)) {
    store.delete(key)
  }
}

export function checkPanelRateLimit(req: NextRequest):
  | { ok: true }
  | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  pruneStore(rateLimitStore, now, PANEL_RATE_LIMIT_MAX_KEYS)

  const key = getClientKey(req)
  const current = rateLimitStore.get(key)

  if (!current || now >= current.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + PANEL_RATE_LIMIT_WINDOW_MS,
    })

    return { ok: true }
  }

  if (current.count >= PANEL_RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    }
  }

  current.count += 1
  return { ok: true }
}

export function checkPanelRefreshCooldown(
  req: NextRequest,
  type: MarketDataPanelKey
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  pruneStore(refreshCooldownStore, now, PANEL_REFRESH_COOLDOWN_MAX_KEYS)

  const key = `${getClientKey(req)}:${type}`
  const current = refreshCooldownStore.get(key)

  if (current && now < current.resetAt) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    }
  }

  refreshCooldownStore.set(key, {
    resetAt: now + PANEL_REFRESH_COOLDOWN_MS,
  })

  return { ok: true }
}

export function clearPanelLimitsForTests() {
  rateLimitStore.clear()
  refreshCooldownStore.clear()
}
