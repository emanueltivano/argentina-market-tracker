// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StockQuoteSuccessResponse } from '@/lib/stockQuote'
import { useStockQuote } from './useStockQuote'

const fetchStockQuote = vi.hoisted(() => vi.fn())

vi.mock('./stockQuoteClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./stockQuoteClient')>()),
  fetchStockQuote,
}))

function quoteResponse(): StockQuoteSuccessResponse {
  return {
    ok: true,
    data: {
      symbol: 'GGAL',
      market: 'bCBA',
      description: 'Grupo Financiero Galicia',
      price: 100,
      variation: null,
      open: null,
      high: null,
      low: null,
      timestamp: null,
      previousClose: null,
      amountTraded: null,
      volume: null,
      averagePrice: null,
      currency: null,
      openInterest: null,
      operationCount: null,
      settlement: null,
      minimumSheet: null,
      lot: null,
      minimumQuantity: null,
      depth: [],
    },
    fetchedAt: '2026-07-15T15:00:00.000Z',
    servedAt: '2026-07-15T15:00:00.000Z',
    staleUntil: '2026-07-15T15:02:00.000Z',
    cacheStatus: 'fresh',
    stale: false,
    source: 'live',
    market: 'bCBA',
    symbol: 'GGAL',
  }
}

function staleQuoteResponse(): StockQuoteSuccessResponse {
  return {
    ...quoteResponse(),
    cacheStatus: 'stale',
    stale: true,
    degradationReason: 'upstream-unavailable',
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

describe('useStockQuote SSR rate-limit handoff', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it.each(['rate-limited', 'rate-limit-unavailable'] as const)(
    'does not fetch on mount for %s and fetches once after explicit retry',
    async (status) => {
      fetchStockQuote.mockResolvedValue(quoteResponse())
      const { result } = renderHook(
        () =>
          useStockQuote('GGAL', 'bCBA', {
            initialState: { status, retryAfterSec: 12 },
          }),
        { wrapper }
      )

      await act(async () => {
        await Promise.resolve()
      })
      expect(fetchStockQuote).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.retry()
      })

      expect(fetchStockQuote).toHaveBeenCalledOnce()
      expect(fetchStockQuote).toHaveBeenCalledWith(
        '/api/stocks/GGAL/quote?market=bCBA'
      )
      expect(result.current.initialState.status).toBe('available')
    }
  )

  it('preserves stale data after a failed retry and replaces it after a successful retry', async () => {
    fetchStockQuote.mockResolvedValueOnce(staleQuoteResponse())
    const { result } = renderHook(
      () =>
        useStockQuote('GGAL', 'bCBA', {
          initialData: staleQuoteResponse(),
          initialState: { status: 'available' },
        }),
      { wrapper }
    )

    expect(fetchStockQuote).not.toHaveBeenCalled()
    expect(result.current.stale).toBe(true)
    expect(result.current.quote?.price).toBe(100)

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.stale).toBe(true)
    expect(result.current.quote?.price).toBe(100)

    fetchStockQuote.mockResolvedValueOnce({
      ...quoteResponse(),
      data: { ...quoteResponse().data, price: 101 },
    })
    await act(async () => {
      await result.current.retry()
    })

    await waitFor(() => expect(result.current.stale).toBe(false))
    expect(result.current.quote?.price).toBe(101)
  })

  it('coalesces concurrent manual retries and restores the pending state', async () => {
    const pending = deferred<StockQuoteSuccessResponse>()
    fetchStockQuote.mockReturnValueOnce(pending.promise)
    const { result } = renderHook(
      () =>
        useStockQuote('GGAL', 'bCBA', {
          initialState: { status: 'rate-limited', retryAfterSec: 45 },
        }),
      { wrapper }
    )

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.retry()
      second = result.current.retry()
    })

    expect(first).toBe(second)
    expect(result.current.isRetrying).toBe(true)
    expect(fetchStockQuote).toHaveBeenCalledOnce()

    pending.resolve(quoteResponse())
    await act(async () => {
      await first
    })

    expect(result.current.isRetrying).toBe(false)
    expect(result.current.initialState.status).toBe('available')
  })

  it('restores manual retry after a failed request without hiding the notice', async () => {
    fetchStockQuote.mockRejectedValueOnce(new Error('network failed'))
    const { result } = renderHook(
      () =>
        useStockQuote('GGAL', 'bCBA', {
          initialState: { status: 'rate-limited', retryAfterSec: 45 },
        }),
      { wrapper }
    )

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.isRetrying).toBe(false)
    expect(result.current.initialState.status).toBe('rate-limited')
  })
})
