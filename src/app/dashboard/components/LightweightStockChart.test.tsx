// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LightweightStockChart from './LightweightStockChart'

const chartMocks = vi.hoisted(() => {
  const setData = vi.fn()
  const fitContent = vi.fn()
  const applyOptions = vi.fn()
  const remove = vi.fn()
  const addSeries = vi.fn(() => ({ setData }))
  const createChart = vi.fn(() => ({
    addSeries,
    applyOptions,
    remove,
    timeScale: () => ({ fitContent }),
  }))

  return {
    addSeries,
    applyOptions,
    createChart,
    fitContent,
    remove,
    setData,
  }
})

vi.mock('lightweight-charts', () => ({
  AreaSeries: 'AreaSeries',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineSeries: 'LineSeries',
  LineStyle: { Solid: 0 },
  createChart: chartMocks.createChart,
}))

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('LightweightStockChart', () => {
  beforeEach(() => {
    chartMocks.addSeries.mockClear()
    chartMocks.applyOptions.mockClear()
    chartMocks.createChart.mockClear()
    chartMocks.fitContent.mockClear()
    chartMocks.remove.mockClear()
    chartMocks.setData.mockClear()
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders a fallback when there is no historical data', () => {
    render(<LightweightStockChart points={[]} symbol="AAPL" />)

    expect(screen.getByText('Sin histórico disponible')).not.toBeNull()
    expect(chartMocks.createChart).not.toHaveBeenCalled()
  })

  it('creates an area chart with historical data', () => {
    render(
      <LightweightStockChart
        symbol="GGAL"
        points={[
          { date: '2026-05-06', close: 101 },
          { date: '2026-05-07', close: 103 },
        ]}
      />
    )

    expect(
      screen.getByRole('img', {
        name: 'Evolución del precio de cierre de GGAL',
      })
    ).not.toBeNull()
    expect(chartMocks.createChart).toHaveBeenCalledTimes(1)
    expect(chartMocks.addSeries).toHaveBeenCalledWith(
      'AreaSeries',
      expect.objectContaining({ lineColor: '#008f5a' })
    )
    expect(chartMocks.setData).toHaveBeenCalledWith([
      { time: '2026-05-06', value: 101 },
      { time: '2026-05-07', value: 103 },
    ])
  })

  it('supports line charts and removes the chart on unmount', () => {
    const { unmount } = render(
      <LightweightStockChart
        type="line"
        symbol="YPFD"
        points={[{ date: '2026-05-07', close: 101 }]}
      />
    )

    expect(chartMocks.addSeries).toHaveBeenCalledWith(
      'LineSeries',
      expect.objectContaining({ color: '#1c36be' })
    )

    unmount()

    expect(chartMocks.remove).toHaveBeenCalledTimes(1)
  })
})
