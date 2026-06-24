// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  serializeStockSort,
  STOCK_SORT_STORAGE_KEY,
} from '@/features/dashboard/stocks/stockSortPersistence'
import {
  cleanupPanelTest,
  panelResponse,
  renderedTickers,
  renderPanel,
  renderPanelView,
  replace,
  setCurrentSearchParams,
  setupPanelTest,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel sorting', () => {
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
    setCurrentSearchParams('sort=var&dir=desc')
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
    setCurrentSearchParams('sort=var&dir=sideways')
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
    setCurrentSearchParams('sort=ticker&dir=asc')
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

    setCurrentSearchParams('sort=var&dir=desc')
    view.rerender(
      renderPanelView()

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
})
