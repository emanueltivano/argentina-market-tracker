// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import { type ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type StockHistoryRange } from '@/lib/stockHistory'
import { useStockHistory } from './useStockHistory'

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
}: {
  symbol: string
  range?: StockHistoryRange
  market?: string
}) {
  const history = useStockHistory(symbol, range, market)

  return <output>{history.viewStatus}</output>
}

describe('useStockHistory', () => {
  afterEach(() => {
    cleanup()
    mocks.fetchStockHistory.mockReset()
  })

  it('does not fetch when the symbol is missing', () => {
    renderWithSWR(<HistoryProbe symbol="   " />)

    expect(screen.getByText('empty')).not.toBeNull()
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
    expect(screen.getByText('loading')).not.toBeNull()
  })
})
