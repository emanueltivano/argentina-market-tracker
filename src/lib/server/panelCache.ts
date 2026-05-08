import 'server-only'

import type { MarketDataPanelKey } from '@/lib/market'
import {
  normalizePanelData,
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
  const response = createPanelResponse(
    normalizePanelData(data),
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
