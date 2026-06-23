// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('@/app/dashboard/hooks/useStockHistory', () => ({
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
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the dedicated stock page with basic stock information', () => {
    setPanelResponses({ data: panelResponse() })

    render(<StockDetailPageClient symbol="GGAL" />)

    expect(screen.getByRole('heading', { name: 'GGAL' })).toBeDefined()
    expect(screen.getByText('Grupo Financiero Galicia')).toBeDefined()
    expect(screen.getAllByText('$ 123,45').length).toBeGreaterThan(0)
    const variationClassName = screen.getAllByText('+ 5,25%')[0]?.className
    expect(variationClassName).toContain('stock-var-positive')
    expect(variationClassName).toContain('stock-var-strong')
    expect(
      screen.getByRole('link', { name: 'Volver al dashboard' }).getAttribute('href')
    ).toBe('/')
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
