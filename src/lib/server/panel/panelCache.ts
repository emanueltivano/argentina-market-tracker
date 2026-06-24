import 'server-only'

import type { MarketDataPanelKey } from '@/lib/market'
import {
  normalizePanelData,
  normalizePanelDataResult,
  type PanelSuccessResponse,
  type PanelTitulo,
} from '@/lib/panel'
import { getDemoPanelData } from '@/lib/server/demo/demoMarketData'
import { ENV } from '@/lib/server/core/env'
import { iolFetch } from '@/lib/server/upstream/iol'
import { incrementMetricCounter, logServerWarn } from '@/lib/server/core/observability'
import { getPanelEndpoint } from '@/lib/server/panel/panelEndpoint'

const PANEL_CACHE_TTL_MS = 30_000

type PanelCacheEntry = {
  data: PanelTitulo[]
  fetchedAt: string
  expiresAt: number
}

const panelCache = new Map<MarketDataPanelKey, PanelCacheEntry>()
const inFlightPanelRequests = new Map<
  MarketDataPanelKey,
  Promise<PanelSuccessResponse>
>()
const inFlightPanelRefreshRequests = new Map<
  MarketDataPanelKey,
  Promise<PanelSuccessResponse>
>()

function getFixturePanelResponse(
  type: MarketDataPanelKey
): PanelSuccessResponse | null {
  const fixture = process.env.PANEL_RESPONSE_FIXTURE_JSON

  if (!fixture) {
    return null
  }

  let parsedFixture: unknown

  try {
    parsedFixture = JSON.parse(fixture)
  } catch {
    throw new Error('Invalid PANEL_RESPONSE_FIXTURE_JSON')
  }

  if (
    !parsedFixture ||
    typeof parsedFixture !== 'object' ||
    Array.isArray(parsedFixture)
  ) {
    throw new Error('Invalid PANEL_RESPONSE_FIXTURE_JSON')
  }

  const typedFixture = parsedFixture as Partial<Record<MarketDataPanelKey, unknown>>
  const data = normalizePanelData(typedFixture[type] ?? [])
  const fetchedAt = new Date().toISOString()
  incrementMetricCounter('panel.cache.event.total', 1, {
    event: 'fixture-hit',
    panelType: type,
  })

  return createPanelResponse(data, fetchedAt, 'fresh')
}

function createPanelResponse(
  data: PanelCacheEntry['data'],
  fetchedAt: string,
  cacheStatus: PanelSuccessResponse['cacheStatus']
): PanelSuccessResponse {
  return {
    ok: true,
    data,
    fetchedAt,
    servedAt: new Date().toISOString(),
    cacheStatus,
  }
}

function getCachedPanelResponse(
  type: MarketDataPanelKey
): PanelSuccessResponse | null {
  const cached = panelCache.get(type)

  if (!cached) {
    incrementMetricCounter('panel.cache.event.total', 1, {
      event: 'miss',
      panelType: type,
    })
    return null
  }

  if (Date.now() >= cached.expiresAt) {
    incrementMetricCounter('panel.cache.event.total', 1, {
      event: 'expired',
      panelType: type,
    })
    return null
  }

  incrementMetricCounter('panel.cache.event.total', 1, {
    event: 'hit',
    panelType: type,
  })

  return createPanelResponse(cached.data, cached.fetchedAt, 'memory-cache')
}

function getStalePanelResponse(
  type: MarketDataPanelKey,
  error: unknown
): PanelSuccessResponse | null {
  const cached = panelCache.get(type)

  if (!cached) {
    return null
  }

  logServerWarn('panel.cache.stale-fallback', {
    panelType: type,
    reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
  })
  incrementMetricCounter('panel.cache.event.total', 1, {
    event: 'stale-fallback',
    panelType: type,
    source: ENV.MARKET_DATA_SOURCE,
  })

  return createPanelResponse(cached.data, cached.fetchedAt, 'memory-cache')
}

function setCachedPanelResponse(
  type: MarketDataPanelKey,
  response: PanelSuccessResponse
) {
  panelCache.set(type, {
    data: response.data,
    fetchedAt: response.fetchedAt,
    expiresAt: Date.now() + PANEL_CACHE_TTL_MS,
  })
  incrementMetricCounter('panel.cache.event.total', 1, {
    event: 'write',
    panelType: type,
    source: ENV.MARKET_DATA_SOURCE,
  })
}

async function fetchPanelResponse(
  type: MarketDataPanelKey
): Promise<PanelSuccessResponse> {
  const fetchedAt = new Date().toISOString()
  const data =
    ENV.MARKET_DATA_SOURCE === 'demo'
      ? getDemoPanelData(type)
      : await iolFetch(getPanelEndpoint(type))
  const normalized = normalizePanelDataResult(data)

  if (normalized.droppedItemsCount > 0) {
    logServerWarn('panel.normalize.partial', {
      panelType: type,
      droppedItemsCount: normalized.droppedItemsCount,
      droppedItemsSummary: normalized.droppedItemsSummary.map(
        (issue) => issue.reason
      ),
    })
  }

  const response = createPanelResponse(
    normalized.data,
    fetchedAt,
    'fresh'
  )

  setCachedPanelResponse(type, response)
  return response
}

function getOrCreateRefreshPanelResponse(
  type: MarketDataPanelKey
): Promise<PanelSuccessResponse> {
  const inFlightRefresh = inFlightPanelRefreshRequests.get(type)

  if (inFlightRefresh) {
    return inFlightRefresh
  }

  const promise = fetchPanelResponse(type)
    .catch((error: unknown) => {
      const stale = getStalePanelResponse(type, error)

      if (stale) {
        return stale
      }

      throw error
    })
    .finally(() => {
      if (inFlightPanelRefreshRequests.get(type) === promise) {
        inFlightPanelRefreshRequests.delete(type)
      }
    })

  inFlightPanelRefreshRequests.set(type, promise)
  return promise
}

export function getOrCreatePanelResponse(
  type: MarketDataPanelKey,
  bypassCache: boolean
): Promise<PanelSuccessResponse> {
  const fixtureResponse = getFixturePanelResponse(type)

  if (fixtureResponse) {
    return Promise.resolve(fixtureResponse)
  }

  if (bypassCache) {
    incrementMetricCounter('panel.cache.event.total', 1, {
      event: 'refresh-bypass',
      panelType: type,
    })
    return getOrCreateRefreshPanelResponse(type)
  }

  const cached = getCachedPanelResponse(type)

  if (cached) {
    return Promise.resolve(cached)
  }

  const inFlight = inFlightPanelRequests.get(type)

  if (inFlight) {
    incrementMetricCounter('panel.cache.event.total', 1, {
      event: 'inflight-hit',
      panelType: type,
    })
    return inFlight
  }

  const inFlightRefresh = inFlightPanelRefreshRequests.get(type)

  if (inFlightRefresh) {
    incrementMetricCounter('panel.cache.event.total', 1, {
      event: 'refresh-inflight-hit',
      panelType: type,
    })
    return inFlightRefresh
  }

  const promise = fetchPanelResponse(type)
    .catch((error: unknown) => {
      const stale = getStalePanelResponse(type, error)

      if (stale) {
        return stale
      }

      throw error
    })
    .finally(() => {
      if (inFlightPanelRequests.get(type) === promise) {
        inFlightPanelRequests.delete(type)
      }
    })

  inFlightPanelRequests.set(type, promise)
  return promise
}

export function hasInFlightPanelRefresh(type: MarketDataPanelKey): boolean {
  return inFlightPanelRefreshRequests.has(type)
}

export function clearPanelResponseCacheForTests() {
  panelCache.clear()
  inFlightPanelRequests.clear()
  inFlightPanelRefreshRequests.clear()
}

export function getPanelCacheStats() {
  return {
    entries: panelCache.size,
    inFlight: inFlightPanelRequests.size,
    inFlightRefresh: inFlightPanelRefreshRequests.size,
    ttlMs: PANEL_CACHE_TTL_MS,
  }
}
