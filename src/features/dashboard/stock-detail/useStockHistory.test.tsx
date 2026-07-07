// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import { type ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type StockHistoryRange } from '@/lib/stockHistory'
import {
  normalizeLiveHistoryPoints,
  STOCK_HISTORY_REFRESH_INTERVAL_MS,
  useStockHistory,
} from './useStockHistory'

const mocks = vi.hoisted(() => ({
  fetchStockHistory: vi.fn(),
}))

vi.mock('./stockHistoryClient', () => ({
  fetchStockHistory: mocks.fetchStockHistory,
}))

function renderWithSWR(ui: ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>
  )
}

function HistoryProbe({
  symbol,
  range = '1M',
  market,
  enabled = true,
}: {
  symbol: string
  range?: StockHistoryRange
  market?: string
  enabled?: boolean
}) {
  const history = useStockHistory(symbol, range, market, { enabled })

  return (
    <output>
      {history.viewStatus}:{history.points.length}:{history.error?.message ?? ''}
    </output>
  )
}

function historyResponse(points = [{ date: '2026-05-01', close: 100 }]) {
  return {
    ok: true as const,
    data: points,
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh' as const,
    range: '1M' as const,
    market: 'bCBA' as const,
    symbol: 'GGAL',
    meta: {
      discardedPoints: 0,
      source: 'demo' as const,
      stale: false,
      totalPoints: points.length,
    },
  }
}

describe('useStockHistory', () => {
  afterEach(() => {
    cleanup()
    mocks.fetchStockHistory.mockReset()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not fetch when the symbol is missing', () => {
    renderWithSWR(<HistoryProbe symbol="   " />)

    expect(screen.getByText('empty:0:')).not.toBeNull()
    expect(mocks.fetchStockHistory).not.toHaveBeenCalled()
  })

  it('does not fetch when disabled', () => {
    renderWithSWR(<HistoryProbe symbol="GGAL" enabled={false} />)

    expect(screen.getByText('empty:0:')).not.toBeNull()
    expect(mocks.fetchStockHistory).not.toHaveBeenCalled()
  })

  it('uses a stable encoded SWR key for valid inputs', async () => {
    mocks.fetchStockHistory.mockReturnValue(new Promise(() => undefined))

    renderWithSWR(<HistoryProbe symbol=" GGAL " range="1W" market=" bCBA " />)

    await waitFor(() => {
      expect(mocks.fetchStockHistory).toHaveBeenCalledWith(
        '/api/stocks/GGAL/history?range=1W&market=bCBA'
      )
    })
    expect(screen.getByText('loading:0:')).not.toBeNull()
  })

  it('polls while enabled and visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    mocks.fetchStockHistory.mockResolvedValue(historyResponse())

    renderWithSWR(<HistoryProbe symbol="GGAL" />)

    await waitFor(() => expect(screen.getByText('success:1:')).not.toBeNull())

    await act(async () => {
      vi.advanceTimersByTime(STOCK_HISTORY_REFRESH_INTERVAL_MS)
    })

    await waitFor(() => expect(mocks.fetchStockHistory).toHaveBeenCalledTimes(2))
    expect(mocks.fetchStockHistory).toHaveBeenLastCalledWith(
      '/api/stocks/GGAL/history?range=1M&market=bCBA',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('does not start overlapping polling requests', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    let resolveRefresh: (value: ReturnType<typeof historyResponse>) => void
    mocks.fetchStockHistory
      .mockResolvedValueOnce(historyResponse())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve
          })
      )

    renderWithSWR(<HistoryProbe symbol="GGAL" />)

    await waitFor(() => expect(screen.getByText('success:1:')).not.toBeNull())

    await act(async () => {
      vi.advanceTimersByTime(STOCK_HISTORY_REFRESH_INTERVAL_MS)
      vi.advanceTimersByTime(STOCK_HISTORY_REFRESH_INTERVAL_MS)
    })

    expect(mocks.fetchStockHistory).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveRefresh!(historyResponse([{ date: '2026-05-02', close: 101 }]))
    })
  })

  it('aborts in-flight polling on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    mocks.fetchStockHistory
      .mockResolvedValueOnce(historyResponse())
      .mockImplementationOnce(() => new Promise(() => undefined))

    const view = renderWithSWR(<HistoryProbe symbol="GGAL" />)

    await waitFor(() => expect(screen.getByText('success:1:')).not.toBeNull())

    await act(async () => {
      vi.advanceTimersByTime(STOCK_HISTORY_REFRESH_INTERVAL_MS)
    })

    const signal = mocks.fetchStockHistory.mock.calls[1]?.[1]?.signal

    view.unmount()

    expect(signal?.aborted).toBe(true)
  })

  it('keeps previous data when a polling refresh fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    mocks.fetchStockHistory
      .mockResolvedValueOnce(historyResponse([{ date: '2026-05-01', close: 100 }]))
      .mockRejectedValueOnce(new Error('refresh failed'))

    renderWithSWR(<HistoryProbe symbol="GGAL" />)

    await waitFor(() => expect(screen.getByText('success:1:')).not.toBeNull())

    await act(async () => {
      vi.advanceTimersByTime(STOCK_HISTORY_REFRESH_INTERVAL_MS)
    })

    await waitFor(() =>
      expect(screen.getByText('success:1:refresh failed')).not.toBeNull()
    )
  })

  it('refreshes once when the window gets focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    mocks.fetchStockHistory.mockResolvedValue(historyResponse())

    renderWithSWR(<HistoryProbe symbol="GGAL" />)

    await waitFor(() => expect(screen.getByText('success:1:')).not.toBeNull())

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(mocks.fetchStockHistory).toHaveBeenCalledTimes(2))
  })

  it('deduplicates points by timestamp and sorts them chronologically', () => {
    expect(
      normalizeLiveHistoryPoints([
        { date: '2026-05-03', close: 103 },
        { date: '2026-05-01', close: 101 },
        { date: '2026-05-02', timestamp: '2026-05-02T20:00:00.000Z', close: 102 },
        { date: '2026-05-02', timestamp: '2026-05-02T20:00:00.000Z', close: 202 },
      ])
    ).toEqual([
      { date: '2026-05-01', close: 101 },
      { date: '2026-05-02', timestamp: '2026-05-02T20:00:00.000Z', close: 202 },
      { date: '2026-05-03', close: 103 },
    ])
  })
})
