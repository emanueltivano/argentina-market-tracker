// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from './Panel'
import {
  serializeStockSort,
  STOCK_SORT_STORAGE_KEY,
} from '../lib/stockSortPersistence'
import {
  FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
  FAVORITE_STOCKS_STORAGE_KEY,
} from '../hooks/useFavoriteStocks'
import { type MarketDataPanelKey } from '@/lib/market'
import { type FavoritesSuccessResponse } from '@/lib/favorites'
import { type PanelSuccessResponse, type PanelTitulo } from '@/lib/panel'

const replace = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace }),
  useSearchParams: () => currentSearchParams,
}))

vi.mock('../hooks/useStockHistory', () => ({
  useStockHistory: () => ({
    points: [],
    error: undefined,
    isLoading: false,
    isRefreshing: false,
    viewStatus: 'empty',
  }),
}))

function panelResponse(data: PanelTitulo[]) {
  return {
    ok: true,
    data,
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh',
  } satisfies PanelSuccessResponse
}

function favoritesResponse(rows: PanelTitulo[], overrides: Partial<FavoritesSuccessResponse> = {}) {
  return {
    ok: true,
    rows,
    missingItems: [],
    failedItems: [],
    source: 'live',
    requestId: 'req-favorites-1234',
    updatedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    stale: false,
    ...overrides,
  } satisfies FavoritesSuccessResponse
}

function renderPanel(props?: {
  initialData?: PanelSuccessResponse
  initialErrorMessage?: string
  initialPanelKey?: MarketDataPanelKey
  isDemoMode?: boolean
}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Panel {...props} />
    </SWRConfig>
  )
}

function renderedTickers() {
  return Array.from(document.querySelectorAll('tbody tr[data-symbol]')).map(
    (row) => row.getAttribute('data-symbol')
  )
}

async function tabUntilFocus(target: HTMLElement, maxTabs = 20) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (document.activeElement === target) {
      return
    }

    await userEvent.tab()
  }

  throw new Error(`Could not focus target after ${maxTabs} tabs`)
}

function mockAutoRefreshInterval() {
  let intervalCallback: (() => void) | undefined

  vi.spyOn(window, 'setInterval').mockImplementation((callback, delay) => {
    if (delay === 60_000) {
      intervalCallback = () => {
        if (typeof callback === 'function') {
          callback()
        }
      }
    }

    return 1 as unknown as ReturnType<typeof window.setInterval>
  })
  vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined)

  return async function triggerAutoRefresh() {
    expect(intervalCallback).toBeDefined()

    await act(async () => {
      intervalCallback?.()
    })
  }
}

describe('Panel', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams()
    replace.mockClear()
    window.localStorage.clear()
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
      this: HTMLDialogElement
    ) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn(function close(
      this: HTMLDialogElement
    ) {
      this.removeAttribute('open')
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the initial loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    renderPanel()

    expect(screen.getByText('Cargando datos...')).not.toBeNull()
    expect(screen.getAllByTestId('stock-table-skeleton-row')).toHaveLength(6)
    expect(screen.queryByText(/Última actualización/)).toBeNull()
  })

  it('renders server-provided initial data without a client fetch on mount', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel({
      initialData: panelResponse([
        { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
      ]),
      initialPanelKey: 'lider',
    })

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a demo badge when demo mode is enabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel({
      isDemoMode: true,
      initialData: panelResponse([
        { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
      ]),
      initialPanelKey: 'lider',
    })

    expect(await screen.findByLabelText('Demo data badge')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders project information outside the operational actions', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    renderPanel()

    const projectLink = screen.getByRole('link', { name: 'Datos y proyecto' })

    expect(projectLink.getAttribute('href')).toBe('/about')
    expect(projectLink.closest('.panel-actions')).toBeNull()
    expect(projectLink.closest('.dashboard-project-footer')).not.toBeNull()
  })

  it('shows compact freshness metadata without exposing manual refresh', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel({
      initialData: panelResponse([
        { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
      ]),
      initialPanelKey: 'lider',
    })

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()
    const freshness = screen.getByText(/Actualizado/)
    const themeToggle = screen.getByRole('button', { name: 'Usar tema oscuro' })

    expect(freshness.closest('.panel-status')).not.toBeNull()
    expect(themeToggle.closest('.panel-actions')).not.toBeNull()
    expect(themeToggle.classList.contains('panel-theme-toggle')).toBe(true)
    expect(themeToggle.classList.contains('ui-icon-button')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders an initial server error and can recover with a client fetch', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        panelResponse([
          { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
        ])
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPanel({
      initialErrorMessage: 'No se pudo cargar el panel de mercado.',
      initialPanelKey: 'lider',
    })

    expect(screen.getByRole('alert').textContent).toBe(
      'Error cargando datos: No se pudo cargar el panel de mercado.'
    )

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()
  })

  it('renders an error state when the API fails without stale data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: 'PANEL_ERROR',
          },
          { status: 502 }
        )
      )
    )

    renderPanel()

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Error cargando datos: No se pudo cargar el panel de mercado.'
    )
  })

  it('renders an empty state with freshness metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(panelResponse([])))
    )

    renderPanel()

    expect(await screen.findByText('No hay datos disponibles.')).not.toBeNull()
    expect(screen.getByText(/Actualizado/)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull()
  })

  it('keeps the empty state visible when automatic refresh fails', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(panelResponse([])))
      .mockResolvedValueOnce(
        Response.json(
          {
            ok: false,
            error: 'PANEL_ERROR',
          },
          { status: 502 }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    expect(await screen.findByText('No hay datos disponibles.')).not.toBeNull()

    await triggerAutoRefresh()

    expect(
      await screen.findByText(
        'No se pudo actualizar. Mostrando últimos datos disponibles.'
      )
    ).not.toBeNull()
    expect(screen.getByText('No hay datos disponibles.')).not.toBeNull()
  })

  it('shows passive updating state during automatic refresh', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    let resolveRefresh: (value: Response) => void
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
      .mockReturnValueOnce(refreshResponse)

    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()

    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull()

    await triggerAutoRefresh()

    expect(screen.getByText('Actualizando...')).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveRefresh!(
      Response.json(panelResponse([{ simbolo: 'YPFD', descripcion: 'YPF' }]))
    )

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()
    await waitFor(() => {
      expect(screen.getByText(/Actualizado/)).not.toBeNull()
    })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/panel?type=lider', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  })

  it('renders stock rows sorted by Ticker ascending by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'YPFD', descripcion: 'YPF' },
            { simbolo: 'ALUA', descripcion: 'Aluar' },
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de ALUA, Aluar' })

    expect(renderedTickers()).toEqual(['ALUA', 'GGAL', 'YPFD'])
    expect(
      screen
        .getByRole('button', { name: 'Ordenar por Ticker descendente' })
        .closest('th')
        ?.getAttribute('aria-sort')
    ).toBe('ascending')
  })

  it('initializes sorting from valid query params', async () => {
    currentSearchParams = new URLSearchParams('sort=var&dir=desc')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'BAJA', descripcion: 'Baja', variacionPorcentual: -3 },
            { simbolo: 'SUBA', descripcion: 'Suba', variacionPorcentual: 4 },
            { simbolo: 'NEUTRAL', descripcion: 'Neutral', variacionPorcentual: 0 },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de SUBA, Suba' })

    expect(renderedTickers()).toEqual(['SUBA', 'NEUTRAL', 'BAJA'])
    expect(
      screen
        .getByRole('button', { name: 'Ordenar por Variación porcentual ascendente' })
        .closest('th')
        ?.getAttribute('aria-sort')
    ).toBe('descending')
  })

  it('falls back to default sorting when query params are invalid', async () => {
    currentSearchParams = new URLSearchParams('sort=var&dir=sideways')
    window.localStorage.setItem(
      STOCK_SORT_STORAGE_KEY,
      serializeStockSort({ key: 'var', direction: 'desc' })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'YPFD', descripcion: 'YPF', variacionPorcentual: -3 },
            { simbolo: 'ALUA', descripcion: 'Aluar', variacionPorcentual: 4 },
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia', variacionPorcentual: 0 },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de ALUA, Aluar' })

    expect(renderedTickers()).toEqual(['ALUA', 'GGAL', 'YPFD'])
  })

  it('uses localStorage sorting when query params are absent', async () => {
    window.localStorage.setItem(
      STOCK_SORT_STORAGE_KEY,
      serializeStockSort({ key: 'var', direction: 'desc' })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'BAJA', descripcion: 'Baja', variacionPorcentual: -3 },
            { simbolo: 'SUBA', descripcion: 'Suba', variacionPorcentual: 4 },
            { simbolo: 'NEUTRAL', descripcion: 'Neutral', variacionPorcentual: 0 },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de SUBA, Suba' })

    expect(renderedTickers()).toEqual(['SUBA', 'NEUTRAL', 'BAJA'])
  })

  it('gives query params priority over localStorage sorting', async () => {
    currentSearchParams = new URLSearchParams('sort=ticker&dir=asc')
    window.localStorage.setItem(
      STOCK_SORT_STORAGE_KEY,
      serializeStockSort({ key: 'var', direction: 'desc' })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'YPFD', descripcion: 'YPF', variacionPorcentual: -3 },
            { simbolo: 'ALUA', descripcion: 'Aluar', variacionPorcentual: 4 },
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia', variacionPorcentual: 0 },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de ALUA, Aluar' })

    expect(renderedTickers()).toEqual(['ALUA', 'GGAL', 'YPFD'])
  })

  it('syncs sorting when query params change during the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'BAJA', descripcion: 'Baja', variacionPorcentual: -3 },
            { simbolo: 'SUBA', descripcion: 'Suba', variacionPorcentual: 4 },
            { simbolo: 'NEUTRAL', descripcion: 'Neutral', variacionPorcentual: 0 },
          ])
        )
      )
    )

    const view = renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de BAJA, Baja' })

    expect(renderedTickers()).toEqual(['BAJA', 'NEUTRAL', 'SUBA'])

    currentSearchParams = new URLSearchParams('sort=var&dir=desc')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    await waitFor(() => {
      expect(renderedTickers()).toEqual(['SUBA', 'NEUTRAL', 'BAJA'])
    })
    expect(
      screen
        .getByRole('button', { name: 'Ordenar por Variación porcentual ascendente' })
        .closest('th')
        ?.getAttribute('aria-sort')
    ).toBe('descending')
  })

  it('sorts Var % descending on first click and ascending on second click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            {
              simbolo: 'BAJA',
              descripcion: 'Baja',
              variacionPorcentual: -3,
            },
            {
              simbolo: 'SUBA',
              descripcion: 'Suba',
              variacionPorcentual: 4,
            },
            {
              simbolo: 'NEUTRAL',
              descripcion: 'Neutral',
              variacionPorcentual: 0,
            },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Abrir detalle de BAJA, Baja' })

    const varSortButton = screen.getByRole('button', {
      name: 'Ordenar por Variación porcentual descendente',
    })

    await userEvent.click(varSortButton)

    expect(renderedTickers()).toEqual(['SUBA', 'NEUTRAL', 'BAJA'])
    expect(replace).toHaveBeenLastCalledWith('/?sort=var&dir=desc', {
      scroll: false,
    })
    expect(window.localStorage.getItem(STOCK_SORT_STORAGE_KEY)).toBe(
      serializeStockSort({ key: 'var', direction: 'desc' })
    )
    expect(varSortButton.closest('th')?.getAttribute('aria-sort')).toBe(
      'descending'
    )

    await userEvent.click(varSortButton)

    expect(renderedTickers()).toEqual(['BAJA', 'NEUTRAL', 'SUBA'])
    expect(varSortButton.closest('th')?.getAttribute('aria-sort')).toBe(
      'ascending'
    )
  })

  it('keeps stale rows visible when automatic refresh fails', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            ok: false,
            error: 'PANEL_ERROR',
          },
          { status: 502 }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()

    await triggerAutoRefresh()

    expect(
      await screen.findByText(
        'No se pudo actualizar. Mostrando últimos datos disponibles.'
      )
    ).not.toBeNull()
    expect(
      screen.getByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()
  })

  it('does not show the new panel as updating when the previous panel is refreshing', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const refreshResponse = new Promise<Response>(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
      .mockReturnValueOnce(refreshResponse)
      .mockResolvedValueOnce(
        Response.json(panelResponse([{ simbolo: 'YPFD', descripcion: 'YPF' }]))
      )

    vi.stubGlobal('fetch', fetchMock)

    const view = renderPanel()

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()

    await triggerAutoRefresh()

    expect(await screen.findByText('Actualizando...')).not.toBeNull()

    currentSearchParams = new URLSearchParams('panel=general')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()

    expect(screen.queryByText('Actualizando...')).toBeNull()
    expect(screen.getByText(/Actualizado/)).not.toBeNull()
  })

  it('auto-refreshes without bypassing the server cache', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
      .mockResolvedValueOnce(
        Response.json(panelResponse([{ simbolo: 'YPFD', descripcion: 'YPF' }]))
      )

    vi.stubGlobal('fetch', fetchMock)
    renderPanel()

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()

    await triggerAutoRefresh()

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/panel?type=lider', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  })

  it('keeps an open stock details modal synced after refresh', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            {
              simbolo: 'GGAL',
              descripcion: 'Grupo Financiero Galicia',
              ultimoPrecio: 100,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            {
              simbolo: 'GGAL',
              descripcion: 'Grupo Financiero Galicia',
              ultimoPrecio: 125,
            },
          ])
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    )

    let dialog = await screen.findByRole('dialog', { name: 'GGAL' })
    expect(dialog.textContent).toContain('$ 100,00')

    await triggerAutoRefresh()

    dialog = await screen.findByRole('dialog', { name: 'GGAL' })
    expect(dialog.textContent).toContain('$ 125,00')
  })

  it('closes the stock details modal when the selected ticker disappears', async () => {
    const triggerAutoRefresh = mockAutoRefreshInterval()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
      .mockResolvedValueOnce(
        Response.json(panelResponse([{ simbolo: 'YPFD', descripcion: 'YPF' }]))
      )

    vi.stubGlobal('fetch', fetchMock)

    renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    )

    expect(await screen.findByRole('dialog', { name: 'GGAL' })).not.toBeNull()

    await triggerAutoRefresh()

    expect(await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: 'GGAL' })).toBeNull()
  })

  it('updates the panel query param when changing panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(panelResponse([])))
    )

    renderPanel()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mostrar panel Panel General' })
    )

    expect(replace).toHaveBeenCalledWith('/?panel=general&sort=ticker&dir=asc', {
      scroll: false,
    })
  })

  it('toggles a favorite without opening the stock details modal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar GGAL a favoritos',
      })
    )

    expect(screen.queryByRole('dialog', { name: 'GGAL' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Quitar GGAL de favoritos' })
    ).not.toBeNull()

    await waitFor(() => {
      expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
        '[{"symbol":"GGAL","market":"bCBA","sourcePanel":"lider"}]'
      )
    })
  })

  it('supports toggling a favorite with the keyboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    const favoriteButton = await screen.findByRole('button', {
      name: 'Agregar GGAL a favoritos',
    })

    await tabUntilFocus(favoriteButton)
    expect(document.activeElement).toBe(favoriteButton)
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false')

    await userEvent.keyboard('{Enter}')

    expect(
      screen.getByRole('button', { name: 'Quitar GGAL de favoritos' })
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Quitar GGAL de favoritos' }).getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('opens the modal by keyboard and restores focus after Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    await userEvent.tab()
    await userEvent.tab()

    const opener = await screen.findByRole('button', {
      name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
    })
    await tabUntilFocus(opener)
    expect(document.activeElement).toBe(opener)
    await userEvent.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog', { name: 'GGAL' })
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toBe(
      document.activeElement
    )

    fireEvent(
      dialog,
      new Event('cancel', { cancelable: true })
    )

    expect(screen.queryByRole('dialog', { name: 'GGAL' })).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('toggles a favorite from the stock details modal without closing it', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      '[{"symbol":"GGAL","market":"bCBA"}]'
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          favoritesResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    )

    const dialog = await screen.findByRole('dialog', { name: 'GGAL' })

    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Quitar GGAL de favoritos',
      })
    )

    expect(await screen.findByRole('dialog', { name: 'GGAL' })).not.toBeNull()
    expect(
      within(await screen.findByRole('dialog', { name: 'GGAL' })).getByRole('button', {
        name: 'Agregar GGAL a favoritos',
      })
    ).not.toBeNull()
    expect(
      await screen.findByText('Todavía no agregaste favoritos.')
    ).not.toBeNull()

    await waitFor(() => {
      expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
        '[]'
      )
    })
  })

  it('shows a newly favorited stock after switching to the Favorites panel', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (url === '/api/favorites?items=bCBA%3AGGAL') {
        return Response.json(
          favoritesResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      }

      return Response.json(
        panelResponse([
          { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          { simbolo: 'YPFD', descripcion: 'YPF' },
        ])
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const view = renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar GGAL a favoritos',
      })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar panel Favoritos' })
    )

    expect(replace).toHaveBeenLastCalledWith(
      '/?panel=favorites&sort=ticker&dir=asc',
      { scroll: false }
    )

    currentSearchParams = new URLSearchParams('panel=favorites')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    await screen.findByRole('button', { name: 'Quitar GGAL de favoritos' })

    expect(renderedTickers()).toEqual(['GGAL'])
    expect(fetchMock).toHaveBeenCalledWith('/api/panel?type=lider', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/favorites?items=bCBA%3AGGAL', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  })

  it.each([
    {
      panel: 'general',
      fetchUrl: '/api/panel?type=general',
      ticker: 'BMA',
      description: 'Banco Macro',
    },
    {
      panel: 'cedears',
      fetchUrl: '/api/panel?type=cedears',
      ticker: 'AAPL',
      description: 'Apple',
    },
  ])(
    'shows a stock favorited from the $panel panel in Favorites without reloading',
    async ({ panel, fetchUrl, ticker, description }) => {
      currentSearchParams = new URLSearchParams(`panel=${panel}`)
      const fetchMock = vi.fn<typeof fetch>(async (url) => {
        if (url === '/api/favorites?items=bCBA%3A' + ticker) {
          return Response.json(
            favoritesResponse([{ simbolo: ticker, descripcion: description }])
          )
        }

        return Response.json(
          panelResponse(
            url === fetchUrl
              ? [{ simbolo: ticker, descripcion: description }]
              : [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }]
          )
        )
      })
      vi.stubGlobal('fetch', fetchMock)

      const view = renderPanel()

      await userEvent.click(
        await screen.findByRole('button', {
          name: `Agregar ${ticker} a favoritos`,
        })
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Mostrar panel Favoritos' })
      )

      currentSearchParams = new URLSearchParams('panel=favorites')
      view.rerender(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <Panel />
        </SWRConfig>
      )

      await screen.findByRole('button', {
        name: `Quitar ${ticker} de favoritos`,
      })

      expect(renderedTickers()).toEqual([ticker])
      expect(fetchMock).toHaveBeenCalledWith(fetchUrl, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      expect(fetchMock).toHaveBeenCalledWith(`/api/favorites?items=bCBA%3A${ticker}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
    }
  )

  it('keeps favorites from different panels in the Favorites listing', async () => {
    currentSearchParams = new URLSearchParams('panel=general')
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (url === '/api/favorites?items=bCBA%3AAAPL%2CbCBA%3ABMA') {
        return Response.json(
          favoritesResponse([
            { simbolo: 'AAPL', descripcion: 'Apple' },
            { simbolo: 'BMA', descripcion: 'Banco Macro' },
          ])
        )
      }

      return Response.json(
        panelResponse(
          url === '/api/panel?type=cedears'
            ? [{ simbolo: 'AAPL', descripcion: 'Apple' }]
            : url === '/api/panel?type=general'
              ? [{ simbolo: 'BMA', descripcion: 'Banco Macro' }]
              : [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }]
        )
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const view = renderPanel()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar BMA a favoritos',
      })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar panel CEDEARs' })
    )

    currentSearchParams = new URLSearchParams('panel=cedears')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar AAPL a favoritos',
      })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar panel Favoritos' })
    )

    currentSearchParams = new URLSearchParams('panel=favorites')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    await screen.findByRole('button', { name: 'Quitar AAPL de favoritos' })

    expect(renderedTickers()).toEqual(['AAPL', 'BMA'])

    await userEvent.click(
      screen.getByRole('button', { name: 'Quitar AAPL de favoritos' })
    )

    expect(renderedTickers()).toEqual(['BMA'])
  })

  it('hydrates favorites from General and CEDEARs after a page reload', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      JSON.stringify([
        { symbol: 'GGAL', market: 'bCBA', sourcePanel: 'lider' },
        { symbol: 'BMA', market: 'bCBA', sourcePanel: 'general' },
        { symbol: 'AAPL', market: 'bCBA', sourcePanel: 'cedears' },
      ])
    )
    window.localStorage.setItem(
      FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify({
        BMA: {
          ticker: 'BMA',
          description: 'Banco Macro',
          price: 120,
          var: 1.5,
          varType: 'positive',
          buyQty: null,
          buyPrice: null,
          sellPrice: null,
          sellQty: null,
          open: 100,
          min: 95,
          max: 125,
          close: 118,
          volume: 1000,
        },
        AAPL: {
          ticker: 'AAPL',
          description: 'Apple',
          price: 250,
          var: -0.5,
          varType: 'negative',
          buyQty: null,
          buyPrice: null,
          sellPrice: null,
          sellQty: null,
          open: 255,
          min: 248,
          max: 260,
          close: 252,
          volume: 2000,
        },
      })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        Response.json(
          typeof url === 'string' && url.startsWith('/api/favorites?items=')
            ? favoritesResponse([
                { simbolo: 'AAPL', descripcion: 'Apple' },
                { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
              ])
            : panelResponse([
                { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
              ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Quitar AAPL de favoritos' })

    expect(renderedTickers()).toEqual(['AAPL', 'BMA', 'GGAL'])

    await userEvent.click(
      screen.getByRole('button', { name: 'Quitar BMA de favoritos' })
    )

    await waitFor(() => {
      expect(renderedTickers()).toEqual(['AAPL', 'GGAL'])
    })
    await waitFor(() => {
      expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
        '[{"symbol":"AAPL","market":"bCBA","sourcePanel":"cedears"},{"symbol":"GGAL","market":"bCBA","sourcePanel":"lider"}]'
      )
    })
    expect(
      JSON.parse(
        window.localStorage.getItem(FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY) ?? '{}'
      )
    ).not.toHaveProperty('BMA')
  })

  it('renders stale favorite snapshots when the source panel fails', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      '[{"symbol":"AAPL","market":"bCBA"}]'
    )
    window.localStorage.setItem(
      FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify({
        AAPL: {
          ticker: 'AAPL',
          description: 'Apple',
          price: 250,
          var: -0.5,
          varType: 'negative',
          buyQty: null,
          buyPrice: null,
          sellPrice: null,
          sellQty: null,
          open: 255,
          min: 248,
          max: 260,
          close: 252,
          volume: 2000,
        },
      })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            error: 'FAVORITES_ERROR',
          },
          { status: 502 }
        )
      )
    )

    renderPanel()

    expect(
      await screen.findByRole('button', { name: 'Quitar AAPL de favoritos' })
    ).not.toBeNull()
    expect(
      screen.getByText(
        'Datos locales desactualizados.'
      )
    ).not.toBeNull()
    expect(document.querySelector('tr[data-symbol="AAPL"]')?.className).toContain(
      'stock-row-stale'
    )
    expect(screen.queryByText(/Error cargando datos:/)).toBeNull()
  })

  it('shows an empty state in the favorites panel when there are no favorites', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
            { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          ])
        )
      )
    )

    renderPanel()

    expect(
      await screen.findByText('Todavía no agregaste favoritos.')
    ).not.toBeNull()
  })

  it('shows a temporary failure notice for partially updated favorites', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      '[{"symbol":"GGAL","market":"bCBA"},{"symbol":"AGRO","market":"bCBA"}]'
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          favoritesResponse(
            [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
            { failedItems: ['bCBA:AGRO'] }
          )
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Quitar GGAL de favoritos' })

    expect(
      screen.getByText(
        'Algunos favoritos no pudieron actualizarse temporalmente: bCBA:AGRO.'
      )
    ).not.toBeNull()
    expect(screen.queryByText(/no están disponibles/i)).toBeNull()
  })

  it('shows differentiated missing and failed item notices from /api/favorites', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      '[{"symbol":"GGAL","market":"bCBA"},{"symbol":"DEMOX","market":"bCBA"},{"symbol":"AGRO","market":"bCBA"}]'
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          favoritesResponse(
            [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
            {
              missingItems: ['bCBA:DEMOX'],
              failedItems: ['bCBA:AGRO'],
            }
          )
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Quitar GGAL de favoritos' })

    expect(
      screen.getByText('Mostrando cotizaciones actualizadas para tus favoritos.')
    ).not.toBeNull()
    expect(
      screen.getByText('Algunos favoritos no están disponibles: bCBA:DEMOX.')
    ).not.toBeNull()
    expect(
      screen.getByText(
        'Algunos favoritos no pudieron actualizarse temporalmente: bCBA:AGRO.'
      )
    ).not.toBeNull()
  })

  it('filters the favorites panel and keeps sorting over the filtered rows', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites&sort=var&dir=desc')
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      '[{"symbol":"BAJA","market":"bCBA"},{"symbol":"SUBA","market":"bCBA"}]'
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          favoritesResponse([
            { simbolo: 'BAJA', descripcion: 'Baja', variacionPorcentual: -3 },
            { simbolo: 'FUERA', descripcion: 'Fuera', variacionPorcentual: 10 },
            { simbolo: 'SUBA', descripcion: 'Suba', variacionPorcentual: 4 },
          ])
        )
      )
    )

    renderPanel()

    await screen.findByRole('button', { name: 'Quitar SUBA de favoritos' })

    expect(renderedTickers()).toEqual(['SUBA', 'BAJA'])
    expect(screen.queryByText('FUERA')).toBeNull()
  })
})
