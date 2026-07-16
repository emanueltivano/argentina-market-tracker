// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
const swrCallMock = vi.hoisted(() => vi.fn())
const swrMutateMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const historyState = vi.hoisted(() => ({
  points: [] as Array<Record<string, unknown>>,
  useStockHistory: vi.fn(),
}))

vi.mock('swr', () => ({
  default: (key: string, fetcher: unknown, options: unknown) => {
    swrCallMock(key, fetcher, options)
    const fallbackData =
      typeof options === 'object' && options !== null && 'fallbackData' in options
        ? options.fallbackData
        : undefined

    return {
      data: swrResponses.get(key)?.data ?? fallbackData,
      error: swrResponses.get(key)?.error,
      isLoading: swrResponses.get(key)?.isLoading ?? false,
      isValidating: false,
      mutate: swrMutateMock,
    }
  },
}))

vi.mock('@/features/dashboard/stock-detail/useStockHistory', () => ({
  useStockHistory: historyState.useStockHistory,
}))

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
    staleUntil: '2026-06-24T20:02:00.000Z',
    cacheStatus: 'fresh' as const,
    stale: false,
    source: 'live' as const,
    market: 'bCBA' as const,
    symbol: 'GGAL',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('StockDetailPageClient', () => {
  beforeEach(() => {
    swrResponses.clear()
    historyState.points = []
    historyState.useStockHistory.mockImplementation(() => ({
      points: historyState.points,
      error: undefined,
      isLoading: false,
      isRefreshing: false,
      viewStatus: 'empty',
    }))
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    historyState.useStockHistory.mockReset()
  })

  it('renders the dedicated stock page with basic stock information', () => {
    const { container } = render(
      <StockDetailPageClient symbol="GGAL" initialQuote={quoteResponse()} />
    )

    expect(screen.getByRole('heading', { name: 'GGAL' })).toBeDefined()
    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    const titleRow = container.querySelector('.stock-detail-title-row')
    const topbar = container.querySelector('.stock-detail-page-topbar')
    const actionsRow = container.querySelector('.stock-detail-page-actions')
    const heading = container.querySelector('.stock-detail-page-heading')
    const summary = container.querySelector('.stock-detail-page-summary')
    const backLink = screen.getByRole('link', { name: /volver al dashboard/i })
    const favoriteButton = screen.getByRole('button', {
      name: 'Agregar GGAL a favoritos',
    })

    expect(topbar?.querySelector('h1')?.textContent).toBe('GGAL')
    expect(heading?.querySelector('h1')).toBeNull()
    expect(backLink.getAttribute('href')).toBe('/')
    expect(backLink.textContent).toBe('')
    expect(backLink.classList.contains('stock-detail-icon-button')).toBe(true)
    expect(screen.queryByText('Volver al dashboard')).toBeNull()
    expect(actionsRow?.contains(favoriteButton)).toBe(true)
    expect(favoriteButton.classList.contains('stock-detail-icon-button')).toBe(
      true
    )
    expect(titleRow?.textContent).toContain('Grupo Financiero Galicia S.A')
    expect(titleRow?.textContent).not.toContain('Panel')
    expect(heading?.textContent).toContain('Actualizado:')
    expect(heading?.querySelector('.stock-detail-updated-at')).not.toBeNull()
    expect(summary?.querySelector('.stock-detail-price')?.textContent).toBe(
      '$ 7.615,00'
    )
    expect(summary?.querySelector('.stock-detail-change')?.textContent).toBe(
      '-4,33%'
    )
    expect(
      summary?.querySelector('.stock-detail-summary-values')
    ).not.toBeNull()
    expect(screen.getAllByText('$ 7.615,00').length).toBeGreaterThan(0)
    expect(historyState.useStockHistory).toHaveBeenLastCalledWith(
      'GGAL',
      '1M',
      undefined,
      { enabled: true }
    )
    const variationClassName = screen.getAllByText('-4,33%')[0]?.className
    expect(variationClassName).toContain('stock-var-negative')
    expect(variationClassName).toContain('stock-var-medium')
  })

  it('keeps the individual quote as the header source when history differs', () => {
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

    const { container } = render(
      <StockDetailPageClient symbol="GGAL" initialQuote={quoteResponse()} />
    )
    const summary = container.querySelector('.stock-detail-page-summary')

    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    expect(summary?.querySelector('.stock-detail-price')?.textContent).toBe(
      '$ 7.615,00'
    )
    expect(summary?.querySelector('.stock-detail-change')?.textContent).toBe(
      '-4,33%'
    )
    expect(container.querySelector('.stock-detail-updated-at')?.textContent).toContain(
      'hora argentina'
    )
  })

  it('uses CotizacionDetalle as the primary header source', () => {
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

  it('uses the SSR quote fallback without an immediate quote revalidation', () => {
    const initialQuote = quoteResponse()

    render(
      <StockDetailPageClient symbol="GGAL" initialQuote={initialQuote} />
    )

    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    expect(swrCallMock).toHaveBeenCalledWith(
      '/api/stocks/GGAL/quote?market=bCBA',
      expect.any(Function),
      expect.objectContaining({
        fallbackData: initialQuote,
        revalidateOnMount: false,
      })
    )
  })

  it('keeps an SSR stale quote visible and removes the warning after fresh data arrives', () => {
    const staleQuote = {
      ...quoteResponse(),
      cacheStatus: 'stale' as const,
      stale: true,
      degradationReason: 'upstream-unavailable' as const,
    }
    const { rerender } = render(
      <StockDetailPageClient symbol="GGAL" initialQuote={staleQuote} />
    )

    const warning = screen.getByRole('status')
    expect(warning.textContent).toContain(
      'Los datos de la cotización pueden estar desactualizados.'
    )
    expect(warning.textContent).toContain('Última actualización:')
    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    expect(screen.getAllByText('$ 7.615,00').length).toBeGreaterThan(0)

    swrResponses.set('/api/stocks/GGAL/quote?market=bCBA', {
      data: quoteResponse(),
    })
    rerender(
      <StockDetailPageClient symbol="GGAL" initialQuote={staleQuote} />
    )

    expect(screen.queryByText(/cotización pueden estar desactualizados/)).toBeNull()
  })

  it('renders the SSR quote while the quote hook is hydrating', () => {
    swrResponses.set('/api/stocks/GGAL/quote?market=bCBA', {
      isLoading: true,
    })

    render(
      <StockDetailPageClient symbol="GGAL" initialQuote={quoteResponse()} />
    )

    expect(screen.getByText('Grupo Financiero Galicia S.A')).toBeDefined()
    expect(screen.queryByText('Cargando detalle del activo...')).toBeNull()
  })

  it.each(['rate-limited', 'rate-limit-unavailable'] as const)(
    'does not revalidate on mount after SSR %s and permits an explicit retry',
    async (status) => {
      const user = userEvent.setup()
      swrMutateMock.mockResolvedValueOnce(quoteResponse())

      render(
        <StockDetailPageClient
          symbol="GGAL"
          initialQuoteState={{ status, retryAfterSec: 12 }}
        />
      )

      expect(swrCallMock).toHaveBeenCalledWith(
        '/api/stocks/GGAL/quote?market=bCBA',
        expect.any(Function),
        expect.objectContaining({
          fallbackData: undefined,
          revalidateOnMount: false,
        })
      )
      expect(screen.getByRole('alert').textContent).toContain('12 segundos')
      expect(swrMutateMock).not.toHaveBeenCalled()

      await user.click(
        screen.getByRole('button', { name: 'Reintentar cotización' })
      )

      expect(swrMutateMock).toHaveBeenCalledOnce()
      expect(screen.queryByRole('alert')).toBeNull()
    }
  )

  it('disables the manual retry and ignores a second click while pending', async () => {
    const pending = deferred<ReturnType<typeof quoteResponse>>()
    swrMutateMock.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(
      <StockDetailPageClient
        symbol="GGAL"
        initialQuoteState={{ status: 'rate-limited', retryAfterSec: 45 }}
      />
    )

    const retryButton = screen.getByRole('button', {
      name: 'Reintentar cotización',
    })
    await user.click(retryButton)

    const pendingButton = screen.getByRole('button', {
      name: 'Reintentando cotización…',
    })
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true)
    await user.click(pendingButton)
    expect(swrMutateMock).toHaveBeenCalledOnce()

    await act(async () => pending.resolve(quoteResponse()))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('uses historical volume when quote detail reports zero', () => {
    historyState.points = [
      {
        date: '2026-06-24',
        close: 7615,
        volume: 164867,
      },
    ]
    swrResponses.set('/api/stocks/ALUA/quote?market=bCBA', {
      data: {
        ...quoteResponse(),
        data: {
          ...quoteResponse().data,
          symbol: 'ALUA',
          description: 'Aluar',
          volume: 0,
        },
        symbol: 'ALUA',
      },
    })

    render(<StockDetailPageClient symbol="ALUA" />)

    const volumeValue = screen.getByText('Volumen nominal').nextElementSibling

    expect(volumeValue?.textContent).toBe('164.867')
  })

  it('shows a dash when no full-page volume source is informed', () => {
    swrResponses.set('/api/stocks/ALUA/quote?market=bCBA', {
      data: {
        ...quoteResponse(),
        data: {
          ...quoteResponse().data,
          symbol: 'ALUA',
          description: 'Aluar',
          volume: 0,
        },
        symbol: 'ALUA',
      },
    })

    render(<StockDetailPageClient symbol="ALUA" />)

    const volumeValue = screen.getByText('Volumen nominal').nextElementSibling

    expect(volumeValue?.textContent).toBe('—')
  })

  it('toggles the stock using the existing favorites persistence', async () => {
    const user = userEvent.setup()

    render(
      <StockDetailPageClient symbol="GGAL" initialQuote={quoteResponse()} />
    )

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
    render(<StockDetailPageClient symbol="NOPE" />)

    expect(
      screen.getByText('No encontramos datos disponibles para este activo.')
    ).toBeDefined()
  })

  it('uses the latest historical point when quote detail and snapshot are unavailable', () => {
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

  it('renders an error state when history fails and no quote is available', () => {
    const error = new Error('History unavailable')
    historyState.useStockHistory.mockReturnValue({
      points: [],
      error,
      isLoading: false,
      isRefreshing: false,
      viewStatus: 'error',
    })

    render(<StockDetailPageClient symbol="GGAL" />)

    expect(screen.getByRole('alert').textContent).toContain(
      'No se pudo cargar GGAL'
    )
    expect(screen.getByText('History unavailable')).toBeDefined()
  })

  it('instantiates only the individual quote request and no panel requests', () => {
    render(
      <StockDetailPageClient symbol="GGAL" initialQuote={quoteResponse()} />
    )

    const requestKeys = swrCallMock.mock.calls.map(([key]) => key)
    expect(requestKeys).toEqual(['/api/stocks/GGAL/quote?market=bCBA'])
    expect(requestKeys.some((key) => String(key).startsWith('/api/panel'))).toBe(
      false
    )
  })
})
