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
    points: [],
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
      '+ 5,25%'
    )
    expect(
      summary?.querySelector('.stock-detail-summary-values')
    ).not.toBeNull()
    expect(screen.getAllByText('$ 123,45').length).toBeGreaterThan(0)
    const variationClassName = screen.getAllByText('+ 5,25%')[0]?.className
    expect(variationClassName).toContain('stock-var-positive')
    expect(variationClassName).toContain('stock-var-strong')
    expect(
      screen.getByRole('link', { name: 'Volver al dashboard' }).getAttribute('href')
    ).toBe('/')
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
