// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAVORITE_STOCKS_STORAGE_KEY } from '@/features/dashboard/favorites/useFavoriteStocks'
import StockDetailPageClient from './StockDetailPageClient'

type MockSWRState = {
  data?: unknown
  error?: Error
  isLoading?: boolean
}

const swrResponses = vi.hoisted(() => new Map<string, MockSWRState>())
const historyState = vi.hoisted(() => ({
  points: [] as Array<Record<string, unknown>>,
}))

vi.mock('swr', () => ({
  default: (key: string) => ({
    data: swrResponses.get(key)?.data,
    error: swrResponses.get(key)?.error,
    isLoading: swrResponses.get(key)?.isLoading ?? false,
    isValidating: false,
    mutate: vi.fn(),
  }),
}))

vi.mock('@/features/dashboard/history/useStockHistory', () => ({
  useStockHistory: () => ({
    points: historyState.points,
    error: undefined,
    isLoading: false,
    isRefreshing: false,
    viewStatus: 'empty',
  }),
}))

function panelResponse(symbol = 'GGAL') {
  return {
    ok: true as const,
    data: [
      {
        simbolo: symbol,
        descripcion: 'Grupo Financiero Galicia',
        ultimoPrecio: 123.45,
        variacionPorcentual: 5.25,
        puntas: {
          cantidadCompra: 10,
          precioCompra: 122,
          precioVenta: 124,
          cantidadVenta: 20,
        },
        apertura: 120,
        minimo: 119,
        maximo: 125,
        ultimoCierre: 121,
        volumen: 1000,
      },
    ],
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh' as const,
  }
}

function emptyPanelResponse() {
  return {
    ok: true as const,
    data: [],
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh' as const,
  }
}

function quoteResponse() {
  return {
    ok: true as const,
    data: {
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
        {
          buyQuantity: 1,
          buyPrice: 7500,
          sellPrice: 8050,
          sellQuantity: 85,
        },
      ],
    },
    fetchedAt: '2026-06-24T20:00:00.000Z',
    servedAt: '2026-06-24T20:00:00.000Z',
    source: 'live' as const,
    market: 'bCBA' as const,
    symbol: 'GGAL',
  }
}

function setPanelResponses(
  lider: MockSWRState,
  general: MockSWRState = { data: emptyPanelResponse() },
  cedears: MockSWRState = { data: emptyPanelResponse() }
) {
  swrResponses.set('/api/panel?type=lider', lider)
  swrResponses.set('/api/panel?type=general', general)
  swrResponses.set('/api/panel?type=cedears', cedears)
}

describe('StockDetailPageClient', () => {
  beforeEach(() => {
    swrResponses.clear()
    historyState.points = []
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the dedicated stock page with basic stock information', () => {
    setPanelResponses({ data: panelResponse() })

    const { container } = render(<StockDetailPageClient symbol="GGAL" />)

    expect(screen.getByRole('heading', { name: 'GGAL' })).toBeDefined()
    expect(screen.getByText('Grupo Financiero Galicia')).toBeDefined()
    const titleRow = container.querySelector('.stock-detail-title-row')
    const tickerRow = container.querySelector('.stock-detail-ticker-row')
    const heading = container.querySelector('.stock-detail-page-heading')
    const summary = container.querySelector('.stock-detail-page-summary')

    expect(tickerRow?.querySelector('h1')?.textContent).toBe('GGAL')
    expect(
      tickerRow?.querySelector(
        'button[aria-label="Agregar GGAL a favoritos"]'
      )
    ).not.toBeNull()
    expect(titleRow?.textContent).toContain('Grupo Financiero Galicia')
    expect(titleRow?.textContent).toContain('Panel Líder')
    expect(heading?.textContent).toContain('Actualizado:')
    expect(heading?.querySelector('.stock-detail-updated-at')).not.toBeNull()
    expect(summary?.querySelector('.stock-detail-price')?.textContent).toBe(
      '$ 123,45'
    )
    expect(summary?.querySelector('.stock-detail-change')?.textContent).toBe(
      '+5,25%'
    )
    expect(
      summary?.querySelector('.stock-detail-summary-values')
    ).not.toBeNull()
    expect(screen.getAllByText('$ 123,45').length).toBeGreaterThan(0)
    const variationClassName = screen.getAllByText('+5,25%')[0]?.className
    expect(variationClassName).toContain('stock-var-positive')
    expect(variationClassName).toContain('stock-var-strong')
    expect(
      screen.getByRole('link', { name: 'Volver al dashboard' }).getAttribute('href')
    ).toBe('/')
  })

  it('keeps the panel snapshot as the header source when history differs', () => {
    setPanelResponses({ data: panelResponse() })
    historyState.points = [
      {
        date: '2026-06-23',
        timestamp: '2026-06-23T20:00:00.000Z',
        close: 120,
      },
      {
        date: '2026-06-24',
        timestamp: '2026-06-24T20:39:47.208Z',
        close: 1028,
        dailyVariation: -0.48,
        description: 'Aluar desde IOL',
      },
    ]

    const { container } = render(<StockDetailPageClient symbol="GGAL" />)
    const summary = container.querySelector('.stock-detail-page-summary')

    expect(screen.getByText('Grupo Financiero Galicia')).toBeDefined()
    expect(summary?.querySelector('.stock-detail-price')?.textContent).toBe(
      '$ 123,45'
    )
    expect(summary?.querySelector('.stock-detail-change')?.textContent).toBe(
      '+5,25%'
    )
    expect(container.querySelector('.stock-detail-updated-at')?.textContent).toContain(
      'hora argentina'
    )
  })

  it('uses CotizacionDetalle as the primary header source', () => {
    setPanelResponses({ data: panelResponse() })
    swrResponses.set('/api/stocks/GGAL/quote?market=bCBA', {
      data: quoteResponse(),
    })

    const { container } = render(<StockDetailPageClient symbol="GGAL" />)
    const summary = container.querySelector('.stock-detail-page-summary')

    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    expect(summary?.querySelector('.stock-detail-price')?.textContent).toBe(
      '$ 7.615,00'
    )
    expect(summary?.querySelector('.stock-detail-change')?.textContent).toBe(
      '-4,33%'
    )
  })

  it('toggles the stock using the existing favorites persistence', async () => {
    setPanelResponses({ data: panelResponse() })
    const user = userEvent.setup()

    render(<StockDetailPageClient symbol="GGAL" />)

    const addButton = await screen.findByRole('button', {
      name: 'Agregar GGAL a favoritos',
    })

    expect(addButton.getAttribute('aria-pressed')).toBe('false')

    await user.click(addButton)

    const removeButton = await screen.findByRole('button', {
      name: 'Quitar GGAL de favoritos',
    })

    expect(removeButton.getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toContain(
      '"symbol":"GGAL"'
    )
  })

  it('renders an empty state when the stock is not found', () => {
    setPanelResponses({ data: emptyPanelResponse() })

    render(<StockDetailPageClient symbol="NOPE" />)

    expect(
      screen.getByText('No encontramos datos disponibles para este activo.')
    ).toBeDefined()
  })

  it('uses the latest historical point when quote detail and snapshot are unavailable', () => {
    setPanelResponses({ data: emptyPanelResponse() })
    historyState.points = [
      {
        date: '2026-06-23',
        close: 7900,
      },
      {
        date: '2026-06-24',
        timestamp: '2026-06-24T20:00:00.000Z',
        close: 7960,
        dailyVariation: 0.76,
        description: 'GGAL histórico',
      },
    ]

    const { container } = render(<StockDetailPageClient symbol="GGAL" />)

    expect(screen.getByText('GGAL histórico')).toBeDefined()
    expect(
      container.querySelector('.stock-detail-price')?.textContent
    ).toBe('$ 7.960,00')
  })

  it('renders an error state when all panel requests fail', () => {
    const error = new Error('Panel unavailable')
    setPanelResponses({ error }, { error }, { error })

    render(<StockDetailPageClient symbol="GGAL" />)

    expect(screen.getByRole('alert').textContent).toContain(
      'No se pudo cargar GGAL'
    )
    expect(screen.getByText('Panel unavailable')).toBeDefined()
  })
})
