// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type StockData } from '@/features/dashboard/shared/stockData'
import { type StockQuoteDetail } from '@/lib/stockQuote'
import StockDetailsContent from './StockDetailsContent'

const chartMocks = vi.hoisted(() => ({
  advancedPoints: vi.fn(),
  simplePoints: vi.fn(),
}))

vi.mock('@/features/dashboard/history/useStockHistory', () => ({
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

vi.mock('@/features/dashboard/charts/LightweightStockChart', () => ({
  default: (props: { points: Array<{ date: string; close: number }> }) => {
    chartMocks.simplePoints(props.points)
    return <div data-testid="simple-chart" />
  },
}))

vi.mock('@/features/dashboard/charts/AdvancedStockDetailChart', () => ({
  default: (props: {
    points: Array<{ date: string; close: number }>
    rangeControls?: React.ReactNode
  }) => {
    chartMocks.advancedPoints(props.points)
    return (
      <div data-testid="advanced-chart">
        <label>
          Tipo de gráfico
          <select defaultValue="candles">
            <option value="candles">Velas</option>
          </select>
        </label>
        {props.rangeControls}
      </div>
    )
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
  quoteDate: '2026-05-03T20:00:00.000Z',
  amountTraded: 330000,
  operationCount: 0,
  currency: 'peso_Argentino',
  settlement: '48hs',
  minimumSheet: 1,
  lot: 1,
}

const pageHistory = {
  points: [
    {
      date: '2026-05-01',
      timestamp: '2026-05-01T20:00:00.000Z',
      open: 98,
      high: 102,
      low: 97,
      close: 100,
      volume: 1000,
    },
    {
      date: '2026-05-02',
      timestamp: '2026-05-02T20:00:00.000Z',
      open: 100,
      high: 112,
      low: 99,
      close: 110,
      volume: 3000,
      dailyVariation: 0,
      previousClose: 0,
      amountTraded: 330000,
      averagePrice: 105.5,
      currency: 'peso_Argentino',
      operationCount: 0,
      settlement: '48hs',
      minimumSheet: 1,
      lot: 1,
      bid: {
        buyQuantity: 10,
        buyPrice: 109,
        sellPrice: 111,
        sellQuantity: 20,
      },
    },
  ],
  meta: {
    discardedPoints: 0,
    source: 'demo' as const,
    stale: false,
    totalPoints: 2,
  },
  error: undefined,
  isLoading: false,
  isRefreshing: false,
  viewStatus: 'success' as const,
}

const quoteDetail: StockQuoteDetail = {
  symbol: 'GGAL',
  market: 'bcba',
  description: 'Grupo Financiero Galicia S.A',
  price: 7615,
  variation: -4.33,
  open: 7860,
  high: 7950,
  low: 7575,
  timestamp: '2026-06-24T16:59:55.3901383-03:00',
  previousClose: 7960,
  amountTraded: 20190703365,
  volume: 0,
  averagePrice: 0,
  currency: 'peso_Argentino',
  openInterest: 0,
  operationCount: 8864,
  settlement: 't1',
  minimumSheet: 1,
  lot: 1,
  minimumQuantity: 1,
  depth: [
    { buyQuantity: 1, buyPrice: 7500, sellPrice: 8050, sellQuantity: 85 },
    { buyQuantity: 65, buyPrice: 7450, sellPrice: 8500, sellQuantity: 10 },
    { buyQuantity: 0, buyPrice: 0, sellPrice: 8540, sellQuantity: 24 },
    { buyQuantity: 0, buyPrice: 0, sellPrice: 8600, sellQuantity: 7 },
    { buyQuantity: 0, buyPrice: 0, sellPrice: 8680, sellQuantity: 1 },
  ],
}

function PageContentHarness() {
  const [range, setRange] = useState<'1W' | '1M' | '3M' | '6M' | '1Y'>('1M')

  return (
    <StockDetailsContent
      stock={stock}
      variant="page"
      historyRange={range}
      onHistoryRangeChange={setRange}
      history={pageHistory}
    />
  )
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
    expect(screen.getByText('Último mes:').textContent).toContain('+10,00%')
    expect(chartMocks.simplePoints).toHaveBeenLastCalledWith([
      expect.objectContaining({ date: '2026-05-01', close: 100 }),
      expect.objectContaining({ date: '2026-05-02', close: 110 }),
    ])
  })

  it('uses the current snapshot for current metrics and history for period metrics', () => {
    render(<PageContentHarness />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Histórico' })
    ).not.toBeNull()
    expect(screen.getByText('Último mes:').textContent).toContain('+10,00%')
    expect(screen.getByLabelText('Tipo de gráfico')).not.toBeNull()
    expect(screen.getByText('Período')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '1W' }))

    expect(screen.getByText('Última semana:').textContent).toContain('+10,00%')
    expect(
      screen.getByRole('button', { name: '1W' }).getAttribute('aria-pressed')
    ).toBe('true')
    expect(screen.getByTestId('advanced-chart')).not.toBeNull()
    expect(screen.queryByTestId('simple-chart')).toBeNull()
    const periodMetrics = screen.getByRole('region', {
      name: 'Resumen del período',
    })

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
      name: 'Cotización diaria',
    })
    const liquiditySection = screen.getByRole('region', { name: 'Liquidez' })
    const marketDepth = screen.getByRole('region', { name: 'Puntas' })

    expect(within(quoteSection).getByText('Apertura')).not.toBeNull()
    expect(within(quoteSection).getByText('Cierre anterior')).not.toBeNull()
    expect(within(quoteSection).getByText('Mínimo diario')).not.toBeNull()
    expect(within(quoteSection).getByText('Máximo diario')).not.toBeNull()
    expect(within(quoteSection).getByText('Variación diaria')).not.toBeNull()
    expect(
      within(quoteSection).getByText('Cierre anterior').nextElementSibling
        ?.textContent
    ).toBe('$ 108,00')
    expect(within(quoteSection).getByText('+1,50%')).not.toBeNull()
    expect(within(quoteSection).queryByText('Precio promedio')).toBeNull()
    expect(
      quoteSection.querySelectorAll('.stock-detail-secondary-metric')
    ).toHaveLength(5)
    expect(within(quoteSection).getByText('Demo')).not.toBeNull()
    expect(within(liquiditySection).getByText('Volumen nominal')).not.toBeNull()
    expect(within(liquiditySection).getByText('Monto operado')).not.toBeNull()
    expect(within(liquiditySection).getByText('$ 330.000,00')).not.toBeNull()
    expect(
      within(liquiditySection).getByText('Cantidad de operaciones')
    ).not.toBeNull()
    expect(within(liquiditySection).getByText('0')).not.toBeNull()
    expect(within(marketDepth).getByText('Cant. compra')).not.toBeNull()
    expect(within(marketDepth).getByText('10')).not.toBeNull()
    expect(within(marketDepth).getByText('Precio compra')).not.toBeNull()
    expect(within(marketDepth).getByText('$ 109,00')).not.toBeNull()
    expect(within(marketDepth).getByText('Precio venta')).not.toBeNull()
    expect(within(marketDepth).getByText('$ 111,00')).not.toBeNull()
    expect(within(marketDepth).getByText('Cant. venta')).not.toBeNull()
    expect(within(marketDepth).getByText('20')).not.toBeNull()
    expect(marketDepth.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(within(liquiditySection).getByText('ARS')).not.toBeNull()
    expect(chartMocks.advancedPoints).toHaveBeenLastCalledWith([
      expect.objectContaining({ date: '2026-05-01', close: 100 }),
      expect.objectContaining({ date: '2026-05-02', close: 110 }),
    ])
  })

  it('keeps the latest quote in the card without adding it to the daily chart', () => {
    render(<PageContentHarness />)

    expect(screen.getAllByText('$ 110,00').length).toBeGreaterThan(0)
    expect(chartMocks.advancedPoints).toHaveBeenLastCalledWith(pageHistory.points)
    expect(
      chartMocks.advancedPoints.mock.calls.at(-1)?.[0].some(
        (point: { date: string }) => point.date === '2026-05-03'
      )
    ).toBe(false)
  })

  it('adds a live session candle from CotizacionDetalle during market hours', () => {
    vi.setSystemTime(new Date('2026-06-24T19:59:56.000Z'))

    render(
      <StockDetailsContent
        stock={stock}
        variant="page"
        historyRange="1M"
        onHistoryRangeChange={() => undefined}
        history={pageHistory}
        quoteDetail={quoteDetail}
        quoteSource="live"
      />
    )

    expect(chartMocks.advancedPoints).toHaveBeenLastCalledWith([
      ...pageHistory.points,
      expect.objectContaining({
        date: '2026-06-24',
        close: 7615,
      }),
    ])
  })

  it('renders CotizacionDetalle metrics and every market-depth row', () => {
    render(
      <StockDetailsContent
        stock={stock}
        variant="page"
        historyRange="1M"
        onHistoryRangeChange={() => undefined}
        history={pageHistory}
        quoteDetail={quoteDetail}
      />
    )

    const quoteSection = screen.getByRole('region', {
      name: 'Cotización diaria',
    })
    const liquiditySection = screen.getByRole('region', { name: 'Liquidez' })
    const marketDepth = screen.getByRole('region', { name: 'Puntas' })

    expect(
      within(quoteSection).getByText('Cierre anterior').nextElementSibling
        ?.textContent
    ).toBe('$ 7.960,00')
    expect(within(liquiditySection).getByText('$ 20.190.703.365,00')).not.toBeNull()
    expect(within(liquiditySection).getByText('8.864')).not.toBeNull()
    expect(marketDepth.querySelectorAll('tbody tr')).toHaveLength(5)
    expect(within(marketDepth).getAllByText('0').length).toBeGreaterThan(0)
    expect(within(marketDepth).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders an empty market-depth state', () => {
    render(
      <StockDetailsContent
        stock={stock}
        variant="page"
        historyRange="1M"
        onHistoryRangeChange={() => undefined}
        history={pageHistory}
        quoteDetail={{ ...quoteDetail, depth: [] }}
      />
    )

    expect(screen.getByText('Sin puntas disponibles')).not.toBeNull()
  })

  it('calculates the modal previous close when snapshot close repeats price', () => {
    render(
      <StockDetailsContent
        stock={{
          ...stock,
          price: 7615,
          var: -4.33,
          varType: 'negative',
          close: 7615,
        }}
      />
    )

    const previousCloseValue = screen.getByText('Cierre anterior')
      .nextElementSibling

    expect(previousCloseValue?.textContent).toBe('$ 7.959,65')
  })

  it('renders an informed zero amount as currency', () => {
    render(
      <StockDetailsContent
        stock={{ ...stock, amountTraded: 0 }}
        variant="page"
        historyRange="1M"
        onHistoryRangeChange={() => undefined}
        history={pageHistory}
      />
    )

    const liquiditySection = screen.getByRole('region', { name: 'Liquidez' })

    expect(within(liquiditySection).getByText('$ 0,00')).not.toBeNull()
  })

  it('renders a dash when amount traded is unavailable in both sources', () => {
    render(
      <StockDetailsContent
        stock={{ ...stock, amountTraded: null }}
        variant="page"
        historyRange="1M"
        onHistoryRangeChange={() => undefined}
        history={{
          ...pageHistory,
          points: pageHistory.points.map((point) => ({
            ...point,
            amountTraded: undefined,
          })),
        }}
      />
    )

    const liquiditySection = screen.getByRole('region', { name: 'Liquidez' })
    const amountValue = within(liquiditySection)
      .getByText('Monto operado')
      .nextElementSibling

    expect(amountValue?.textContent).toBe('—')
  })
})
