// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StockQuoteRequestError } from './stockQuoteClient'
import { useStockQuote } from './useStockQuote'

type CapturedSWRPolicy = {
  onError: (error: StockQuoteRequestError) => void
  onErrorRetry: (
    error: StockQuoteRequestError,
    key: string,
    config: object,
    revalidate: (options: { retryCount: number }) => void,
    options: { retryCount: number }
  ) => void
  refreshInterval: () => number
  revalidateOnMount?: boolean
}

const swrState = vi.hoisted(() => ({
  options: undefined as CapturedSWRPolicy | undefined,
}))

vi.mock('swr', () => ({
  default: (_key: string, _fetcher: unknown, options: typeof swrState.options) => {
    swrState.options = options
    return {
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    }
  },
}))

describe('useStockQuote retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T15:00:00.000Z'))
    swrState.options = undefined
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function policy() {
    renderHook(() => useStockQuote('GGAL', 'bCBA'))
    expect(swrState.options).toBeDefined()
    return swrState.options!
  }

  it('waits for Retry-After and keeps a single timer for the key', () => {
    const options = policy()
    const error = new StockQuoteRequestError(
      'rate limited',
      429,
      'RATE_LIMITED',
      45
    )
    const revalidate = vi.fn()

    options.onError(error)
    options.onErrorRetry(error, 'key', {}, revalidate, { retryCount: 0 })
    options.onErrorRetry(error, 'key', {}, revalidate, { retryCount: 0 })

    act(() => vi.advanceTimersByTime(44_999))
    expect(revalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(revalidate).toHaveBeenCalledOnce()
  })

  it('uses normal backoff without a valid Retry-After', () => {
    const options = policy()
    const error = new StockQuoteRequestError('rate limited', 429, 'RATE_LIMITED')
    const revalidate = vi.fn()

    options.onError(error)
    options.onErrorRetry(error, 'key', {}, revalidate, { retryCount: 0 })

    act(() => vi.advanceTimersByTime(4_999))
    expect(revalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(revalidate).toHaveBeenCalledOnce()
  })

  it('does not retry a confirmed 404', () => {
    const options = policy()
    const error = new StockQuoteRequestError(
      'not found',
      404,
      'QUOTE_NOT_FOUND'
    )
    const revalidate = vi.fn()

    options.onErrorRetry(error, 'key', {}, revalidate, { retryCount: 0 })
    act(() => vi.runAllTimers())

    expect(revalidate).not.toHaveBeenCalled()
  })

  it('keeps polling at least 60 seconds away and honors a longer Retry-After', () => {
    const options = policy()
    const error = new StockQuoteRequestError(
      'rate limited',
      429,
      'RATE_LIMITED',
      75
    )

    options.onError(error)
    expect(options.refreshInterval()).toBe(75_000)
  })

  it('carries SSR Retry-After into the first polling interval', () => {
    renderHook(() =>
      useStockQuote('GGAL', 'bCBA', {
        initialState: { status: 'rate-limited', retryAfterSec: 90 },
      })
    )

    expect(swrState.options?.revalidateOnMount).toBe(false)
    expect(swrState.options?.refreshInterval()).toBe(90_000)
  })
})
