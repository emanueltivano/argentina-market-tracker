import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFavoritePanel } from './favoritePanelClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchFavoritePanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts favorites responses that include failedItems', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          rows: [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
          missingItems: ['bCBA:DEMOX'],
          failedItems: ['bCBA:AGRO'],
          source: 'live',
          requestId: 'req-favorites-1234',
          updatedAt: '2026-05-04T16:00:00.000Z',
          servedAt: '2026-05-04T16:00:01.000Z',
          stale: false,
        })
      )
    )

    await expect(fetchFavoritePanel('/api/favorites?items=bCBA%3AGGAL')).resolves.toEqual({
      ok: true,
      rows: [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
      missingItems: ['bCBA:DEMOX'],
      failedItems: ['bCBA:AGRO'],
      source: 'live',
      requestId: 'req-favorites-1234',
      updatedAt: '2026-05-04T16:00:00.000Z',
      servedAt: '2026-05-04T16:00:01.000Z',
      stale: false,
    })
  })
})
