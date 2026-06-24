// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type StockData } from '../lib/stockData'
import StockDetailsContent from './StockDetailsContent'

const chartMocks = vi.hoisted(() => ({
  advancedPoints: vi.fn(),
  simplePoints: vi.fn(),
}))

vi.mock('../hooks/useStockHistory', () => ({
  useStockHistory: () => ({
    points: [
      {
        date: '2026-05-01',
        open: 98,
        high: 102,
        low: 97,
        close: 100,
        volume: 1000,
      },
      {
        date: '2026-05-02',
        open: 100,
        high: 112,
        low: 99,
        close: 110,
        volume: 3000,
      },
    ],
    meta: {
      discardedPoints: 0,
      source: 'demo',
      stale: false,
      totalPoints: 2,
    },
    error: undefined,
    isLoading: false,
    isRefreshing: false,
    viewStatus: 'success',
  }),
}))

vi.mock('./LightweightStockChart', () => ({
  default: (props: { points: Array<{ date: string; close: number }> }) => {
    chartMocks.simplePoints(props.points)
    return <div data-testid="simple-chart" />
  },
}))

vi.mock('./AdvancedStockDetailChart', () => ({
  default: (props: { points: Array<{ date: string; close: number }> }) => {
    chartMocks.advancedPoints(props.points)
    return <div data-testid="advanced-chart" />
  },
}))

const stock: StockData = {
  ticker: 'GGAL',
  description: 'Grupo Financiero Galicia',
  price: 110,
  var: 1.5,
  varType: 'positive',
  buyQty: 10,
  buyPrice: 109,
  sellPrice: 111,
  sellQty: 20,
  open: 100,
  min: 99,
  max: 112,
  close: 108,
  volume: 3000,
}

describe('StockDetailsContent variants', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T01:30:00.000Z'))
    chartMocks.advancedPoints.mockClear()
    chartMocks.simplePoints.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('keeps the simple chart and omits period metrics in modal mode', () => {
    render(<StockDetailsContent stock={stock} />)

    expect(screen.getByTestId('simple-chart')).not.toBeNull()
    expect(screen.queryByTestId('advanced-chart')).toBeNull()
    expect(screen.queryByLabelText('Métricas del período')).toBeNull()
    expect(screen.queryByText('Datos de cotización')).toBeNull()
    expect(screen.getByText('Último precio')).not.toBeNull()
    expect(screen.getByText('Cantidad compra')).not.toBeNull()
    expect(screen.getByText('Precio venta')).not.toBeNull()
    expect(chartMocks.simplePoints).toHaveBeenLastCalledWith([
      expect.objectContaining({ date: '2026-05-01', close: 100 }),
      expect.objectContaining({ date: '2026-05-02', close: 110 }),
    ])
  })

  it('uses history enriched with today on the detail page', () => {
    render(<StockDetailsContent stock={stock} variant="page" />)

    expect(screen.getByTestId('advanced-chart')).not.toBeNull()
    expect(screen.queryByTestId('simple-chart')).toBeNull()
    const periodMetrics = screen.getByLabelText('Métricas del período')

    expect(within(periodMetrics).getByText('Precio actual')).not.toBeNull()
    expect(
      within(periodMetrics).getByText('Variación del período')
    ).not.toBeNull()
    expect(
      within(periodMetrics).getByText('Máximo del período')
    ).not.toBeNull()
    expect(
      within(periodMetrics).getByText('Mínimo del período')
    ).not.toBeNull()
    expect(within(periodMetrics).queryByText(/Volumen/i)).toBeNull()
    expect(screen.queryByText('Volumen promedio')).toBeNull()
    expect(screen.queryByText('Último precio')).toBeNull()

    const quoteSection = screen.getByRole('region', {
      name: 'Datos de cotización',
    })
    const marketDepth = screen.getByRole('region', { name: 'Puntas' })

    expect(within(quoteSection).getByText('Apertura')).not.toBeNull()
    expect(within(quoteSection).getByText('Último cierre')).not.toBeNull()
    expect(within(quoteSection).getByText('Mínimo diario')).not.toBeNull()
    expect(within(quoteSection).getByText('Máximo diario')).not.toBeNull()
    expect(within(quoteSection).getByText('Variación diaria')).not.toBeNull()
    expect(within(quoteSection).getByText('Volumen')).not.toBeNull()
    expect(within(quoteSection).getByText('Demo')).not.toBeNull()
    expect(within(marketDepth).getByText('Cantidad de compra')).not.toBeNull()
    expect(within(marketDepth).getByText('10')).not.toBeNull()
    expect(within(marketDepth).getByText('Precio de compra')).not.toBeNull()
    expect(within(marketDepth).getByText('$ 109,00')).not.toBeNull()
    expect(within(marketDepth).getByText('Precio de venta')).not.toBeNull()
    expect(within(marketDepth).getByText('$ 111,00')).not.toBeNull()
    expect(within(marketDepth).getByText('Cantidad de venta')).not.toBeNull()
    expect(within(marketDepth).getByText('20')).not.toBeNull()
    expect(
      marketDepth.querySelectorAll('.stock-detail-secondary-metric')
    ).toHaveLength(4)
    expect(
      marketDepth.querySelector('.stock-detail-market-depth-card')
    ).toBeNull()
    expect(within(marketDepth).queryByText('Compra')).toBeNull()
    expect(within(marketDepth).queryByText('Venta')).toBeNull()
    expect(chartMocks.advancedPoints).toHaveBeenLastCalledWith([
      expect.objectContaining({ date: '2026-05-01', close: 100 }),
      expect.objectContaining({ date: '2026-05-02', close: 110 }),
      {
        date: '2026-06-23',
        close: 110,
        open: 100,
        high: 112,
        low: 99,
        volume: 3000,
      },
    ])
  })
})
