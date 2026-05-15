import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchStockHistory,
  getStockHistoryFetchError,
} from './stockHistoryClient'

function jsonResponse(body: unknown, status = 502): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('getStockHistoryFetchError', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('maps backend history errors to a user-facing message', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const error = await getStockHistoryFetchError(
      jsonResponse({
        ok: false,
        error: 'HISTORY_ERROR',
        details: 'sensitive upstream detail',
      })
    )

    expect(error.message).toBe('No se pudo cargar el histórico.')
  })

  it('includes backend details in development when available', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const error = await getStockHistoryFetchError(
      jsonResponse({
        ok: false,
        error: 'HISTORY_ERROR',
        details: 'upstream failed',
      })
    )

    expect(error.message).toBe(
      'No se pudo cargar el histórico. Detalle: upstream failed'
    )
  })
})

describe('fetchStockHistory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes the request URL when the history response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json', { status: 200 }))
    )

    await expect(
      fetchStockHistory('/api/stocks/GGAL/history?range=1M&market=bCBA')
    ).rejects.toThrow(
      'Respuesta inválida del servidor al cargar el histórico: /api/stocks/GGAL/history?range=1M&market=bCBA'
    )
  })
})
