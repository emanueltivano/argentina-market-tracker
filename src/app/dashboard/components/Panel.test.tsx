// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from './Panel'
import {
  serializeStockSort,
  STOCK_SORT_STORAGE_KEY,
} from './stockSortPersistence'

const replace = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace }),
  useSearchParams: () => currentSearchParams,
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

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    const loadingButton = await screen.findByRole('button', {
      name: 'Actualizando...',
    }) as HTMLButtonElement
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
})
