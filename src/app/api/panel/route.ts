import { NextResponse, type NextRequest } from 'next/server'
import { isMarketPanelKey, type MarketPanelKey } from '@/lib/market'
import {
  normalizePanelData,
  type PanelResponse,
  type PanelTitulo,
} from '@/lib/panel'
import { ENV } from '@/lib/server/env'
import { iolFetch } from '@/lib/server/iol'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const PANEL_CACHE_TTL_MS = 30_000
const PANEL_RATE_LIMIT_WINDOW_MS = 60_000
const PANEL_RATE_LIMIT_MAX_REQUESTS = 120
const PANEL_CACHE_CONTROL = 'no-store'

type PanelCacheEntry = {
  data: PanelTitulo[]
  fetchedAt: string
  expiresAt: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const panelCache = new Map<MarketPanelKey, PanelCacheEntry>()
const inFlightPanelRequests = new Map<MarketPanelKey, Promise<PanelResponse>>()
const rateLimitStore = new Map<string, RateLimitEntry>()

const JSON_HEADERS = {
  'Cache-Control': PANEL_CACHE_CONTROL,
}

function getPanelType(req: NextRequest): MarketPanelKey {
  const type = req.nextUrl.searchParams.get('type')

  return isMarketPanelKey(type) ? type : 'lider'
}

function isDebugEnabled() {
  return ENV.NODE_ENV !== 'production' && process.env.ENABLE_TOKEN_DEBUG === '1'
}

function isLocalDebugRequest(req: NextRequest): boolean {
  const host = req.nextUrl.hostname

  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function shouldReturnRawData(req: NextRequest): boolean {
  return (
    isDebugEnabled() &&
    isLocalDebugRequest(req) &&
    req.nextUrl.searchParams.get('raw') === '1'
  )
}

function shouldBypassPanelCache(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('refresh') === '1'
}

function getPanelEndpoint(type: MarketPanelKey): string {
  switch (type) {
    case 'lider':
      return ENV.PANEL_LIDER_ENDPOINT
    case 'general':
      return ENV.PANEL_GENERAL_ENDPOINT
    case 'cedears':
      return ENV.PANEL_CEDEARS_ENDPOINT
  }
}

function createPanelResponse(
  data: PanelCacheEntry['data'],
  fetchedAt: string,
  cacheStatus: Extract<PanelResponse, { ok: true }>['cacheStatus']
): PanelResponse {
  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: new Date().toISOString(),
    cacheStatus,
  }
}

function getCachedPanelResponse(type: MarketPanelKey): PanelResponse | null {
  const cached = panelCache.get(type)

  if (!cached || Date.now() >= cached.expiresAt) {
    panelCache.delete(type)
    return null
  }

  return createPanelResponse(cached.data, cached.fetchedAt, 'memory-cache')
}

function setCachedPanelResponse(type: MarketPanelKey, response: PanelResponse) {
  if (!response.ok) {
    return
  }

  panelCache.set(type, {
    data: response.data,
    fetchedAt: response.fetchedAt,
    expiresAt: Date.now() + PANEL_CACHE_TTL_MS,
  })
}

async function fetchPanelResponse(type: MarketPanelKey): Promise<PanelResponse> {
  const data = await iolFetch(getPanelEndpoint(type))
  const fetchedAt = new Date().toISOString()
  const response = createPanelResponse(
    normalizePanelData(data),
    fetchedAt,
    'fresh'
  )

  setCachedPanelResponse(type, response)
  return response
}

function getOrCreatePanelResponse(
  type: MarketPanelKey,
  bypassCache: boolean
): Promise<PanelResponse> {
  if (bypassCache) {
    return fetchPanelResponse(type)
  }

  const cached = getCachedPanelResponse(type)

  if (cached) {
    return Promise.resolve(cached)
  }

  const inFlight = inFlightPanelRequests.get(type)

  if (inFlight) {
    return inFlight
  }

  const promise = fetchPanelResponse(type).finally(() => {
    if (inFlightPanelRequests.get(type) === promise) {
      inFlightPanelRequests.delete(type)
    }
  })

  inFlightPanelRequests.set(type, promise)
  return promise
}

export function clearPanelCacheForTests() {
  panelCache.clear()
  inFlightPanelRequests.clear()
  rateLimitStore.clear()
}

function getRateLimitKey(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()

  return forwardedFor || realIp || 'local'
}

function checkRateLimit(req: NextRequest):
  | { ok: true }
  | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const key = getRateLimitKey(req)
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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

export async function GET(req: NextRequest) {
  const type = getPanelType(req)
  const shouldReturnRaw = shouldReturnRawData(req)
  const bypassCache = shouldBypassPanelCache(req)
  const rateLimit = checkRateLimit(req)

  if (!rateLimit.ok) {
    return jsonResponse(
      {
        ok: false,
        error: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSec),
        },
      }
    )
  }

  try {
    if (shouldReturnRaw) {
      const data = await iolFetch(getPanelEndpoint(type))

      return jsonResponse({
        ok: true,
        type,
        data,
      })
    }

    const response = await getOrCreatePanelResponse(type, bypassCache)

    return jsonResponse(response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const isProd = ENV.NODE_ENV === 'production'

    return jsonResponse(
      {
        ok: false,
        error: 'PANEL_ERROR',
        ...(isProd ? {} : { details: message }),
      },
      { status: 502 }
    )
  }
}

export function POST() {
  return jsonResponse(
    {
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
    },
    {
      status: 405,
      headers: { Allow: 'GET' },
    }
  )
}
