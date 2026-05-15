import 'server-only'

import type { MarketDataPanelKey } from '@/lib/market'
import {
  normalizePanelData,
  normalizePanelDataResult,
  type PanelSuccessResponse,
  type PanelTitulo,
} from '@/lib/panel'
import { iolFetch } from '@/lib/server/iol'
import { getPanelEndpoint } from '@/lib/server/panelEndpoint'

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

  if (!cached || Date.now() >= cached.expiresAt) {
    panelCache.delete(type)
    return null
  }

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
}

async function fetchPanelResponse(
  type: MarketDataPanelKey
): Promise<PanelSuccessResponse> {
  const data = await iolFetch(getPanelEndpoint(type))
  const fetchedAt = new Date().toISOString()
  const normalized = normalizePanelDataResult(data)

  if (normalized.droppedItemsCount > 0) {
    console.warn('[panel.normalize.partial]', {
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

  const promise = fetchPanelResponse(type).finally(() => {
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
    return getOrCreateRefreshPanelResponse(type)
  }

  const cached = getCachedPanelResponse(type)

  if (cached) {
    return Promise.resolve(cached)
  }

  const inFlight = inFlightPanelRequests.get(type)

  if (inFlight) {
    return inFlight
  }

  const inFlightRefresh = inFlightPanelRefreshRequests.get(type)

  if (inFlightRefresh) {
    return inFlightRefresh
  }

  const promise = fetchPanelResponse(type).finally(() => {
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
