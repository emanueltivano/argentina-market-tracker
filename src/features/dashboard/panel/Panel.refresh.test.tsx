// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupPanelTest,
  mockAutoRefreshInterval,
  panelResponse,
  renderPanel,
  renderPanelView,
  setCurrentSearchParams,
  setupPanelTest,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel refresh', () => {
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

    setCurrentSearchParams('panel=general')
    view.rerender(
      renderPanelView()

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
})
