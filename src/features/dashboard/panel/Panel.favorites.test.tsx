// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
  FAVORITE_STOCKS_STORAGE_KEY,
} from '@/features/dashboard/favorites/useFavoriteStocks'
import {
  cleanupPanelTest,
  favoritesResponse,
  panelResponse,
  renderedTickers,
  renderPanel,
  renderPanelView,
  replace,
  setCurrentSearchParams,
  setupPanelTest,
  tabUntilFocus,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel favorites', () => {
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

  it('toggles a favorite from the stock details modal without closing it', async () => {
    setCurrentSearchParams('panel=favorites')
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

    setCurrentSearchParams('panel=favorites')
    view.rerender(
      renderPanelView()

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
      setCurrentSearchParams(`panel=${panel}`)
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

      setCurrentSearchParams('panel=favorites')
      view.rerender(
        renderPanelView()
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
    setCurrentSearchParams('panel=general')
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

    setCurrentSearchParams('panel=cedears')
    view.rerender(
      renderPanelView()

    )

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar AAPL a favoritos',
      })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar panel Favoritos' })
    )

    setCurrentSearchParams('panel=favorites')
    view.rerender(
      renderPanelView()

    )

    await screen.findByRole('button', { name: 'Quitar AAPL de favoritos' })

    expect(renderedTickers()).toEqual(['AAPL', 'BMA'])

    await userEvent.click(
      screen.getByRole('button', { name: 'Quitar AAPL de favoritos' })
    )

    expect(renderedTickers()).toEqual(['BMA'])
  })

  it('hydrates favorites from General and CEDEARs after a page reload', async () => {
    setCurrentSearchParams('panel=favorites')
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
    setCurrentSearchParams('panel=favorites')
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
    setCurrentSearchParams('panel=favorites')
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
    setCurrentSearchParams('panel=favorites')
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
    setCurrentSearchParams('panel=favorites')
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
    setCurrentSearchParams('panel=favorites&sort=var&dir=desc')
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
