// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import {
  act,
  cleanup,
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
} from './stockSortPersistence'
import {
  FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
  FAVORITE_STOCKS_STORAGE_KEY,
} from '../hooks/useFavoriteStocks'

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

function panelResponse(data: unknown[]) {
  return {
    ok: true,
    data,
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh',
  }
}

function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Panel />
    </SWRConfig>
  )
}

function renderedTickers() {
  return Array.from(document.querySelectorAll('tbody tr[data-symbol]')).map(
    (row) => row.getAttribute('data-symbol')
  )
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

  it('renders an empty state with freshness controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(panelResponse([])))
    )

    renderPanel()

    expect(await screen.findByText('No hay datos disponibles.')).not.toBeNull()
    expect(screen.getByText(/Última actualización:/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Actualizar' })).not.toBeNull()
  })

  it('keeps the empty state visible when manual refresh fails after empty data', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    expect(
      await screen.findByText(
        'No se pudo actualizar. Mostrando últimos datos disponibles.'
      )
    ).not.toBeNull()
    expect(screen.getByText('No hay datos disponibles.')).not.toBeNull()
  })

  it('renders rows and refreshes manually with a cache bypass request', async () => {
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

    const idleButton = screen.getByRole('button', { name: 'Actualizar' })
    expect(idleButton).not.toBeNull()

    await userEvent.click(idleButton)

    const loadingButton = await screen.findByRole('button', {
      name: 'Actualizando...',
    }) as HTMLButtonElement
    expect(loadingButton.getAttribute('aria-busy')).toBe('true')
    expect(loadingButton.disabled).toBe(true)

    await userEvent.click(loadingButton)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveRefresh!(
      Response.json(panelResponse([{ simbolo: 'YPFD', descripcion: 'YPF' }]))
    )

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Actualizar' }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/panel?type=lider&refresh=1', {
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

  it('keeps stale rows visible when manual refresh fails', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

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

  it('does not keep the new panel refresh button busy when the previous panel is refreshing', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    const previousPanelRefreshButton = (await screen.findByRole('button', {
      name: 'Actualizando...',
    })) as HTMLButtonElement
    expect(previousPanelRefreshButton.disabled).toBe(true)

    currentSearchParams = new URLSearchParams('panel=general')
    view.rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <Panel />
      </SWRConfig>
    )

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()

    const refreshButton = screen.getByRole('button', { name: 'Actualizar' })
    expect((refreshButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('auto-refreshes without bypassing the server cache', async () => {
    let intervalCallback: (() => void) | undefined
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

    renderPanel()

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()

    await act(async () => {
      intervalCallback?.()
    })

    expect(intervalCallback).toBeDefined()

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/panel?type=lider', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  })

  it('keeps an open stock details modal synced after refresh', async () => {
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

    let dialog = screen.getByRole('dialog', { name: 'GGAL' })
    expect(dialog.textContent).toContain('$ 100,00')

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    dialog = await screen.findByRole('dialog', { name: 'GGAL' })
    expect(dialog.textContent).toContain('$ 125,00')
  })

  it('closes the stock details modal when the selected ticker disappears', async () => {
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

    expect(screen.getByRole('dialog', { name: 'GGAL' })).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

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
        '["GGAL"]'
      )
    })
  })

  it('toggles a favorite from the stock details modal without closing it', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites')
    window.localStorage.setItem(FAVORITE_STOCKS_STORAGE_KEY, '["GGAL"]')
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
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    )

    const dialog = screen.getByRole('dialog', { name: 'GGAL' })

    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Quitar GGAL de favoritos',
      })
    )

    expect(screen.getByRole('dialog', { name: 'GGAL' })).not.toBeNull()
    expect(
      within(screen.getByRole('dialog', { name: 'GGAL' })).getByRole('button', {
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
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(
        panelResponse([
          { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
          { simbolo: 'YPFD', descripcion: 'YPF' },
        ])
      )
    )
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
    expect(
      fetchMock.mock.calls.some(([url]) => url === '/api/panel?type=favorites')
    ).toBe(false)
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
        const data =
          url === fetchUrl
            ? [{ simbolo: ticker, descripcion: description }]
            : [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }]

        return Response.json(panelResponse(data))
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
      expect(
        fetchMock.mock.calls.some(([url]) => url === '/api/panel?type=favorites')
      ).toBe(false)
    }
  )

  it('keeps favorites from different panels in the Favorites listing', async () => {
    currentSearchParams = new URLSearchParams('panel=general')
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const data =
        url === '/api/panel?type=cedears'
          ? [{ simbolo: 'AAPL', descripcion: 'Apple' }]
          : url === '/api/panel?type=general'
            ? [{ simbolo: 'BMA', descripcion: 'Banco Macro' }]
            : [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }]

      return Response.json(panelResponse(data))
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
      JSON.stringify(['GGAL', 'BMA', 'AAPL'])
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
      vi.fn(async () =>
        Response.json(
          panelResponse([
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

    expect(renderedTickers()).toEqual(['AAPL', 'GGAL'])
    await waitFor(() => {
      expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
        '["AAPL","GGAL"]'
      )
    })
    expect(
      JSON.parse(
        window.localStorage.getItem(FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY) ?? '{}'
      )
    ).not.toHaveProperty('BMA')
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

  it('filters the favorites panel and keeps sorting over the filtered rows', async () => {
    currentSearchParams = new URLSearchParams('panel=favorites&sort=var&dir=desc')
    window.localStorage.setItem(FAVORITE_STOCKS_STORAGE_KEY, '["BAJA","SUBA"]')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          panelResponse([
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
