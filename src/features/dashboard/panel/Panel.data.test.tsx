// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupPanelTest,
  mockAutoRefreshInterval,
  panelResponse,
  renderPanel,
  replace,
  setupPanelTest,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel data', () => {
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

  it('keeps stale panel rows visible and labels them as outdated', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel({
      initialData: panelResponse(
        [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
        {
          cacheStatus: 'stale',
          stale: true,
          degradationReason: 'upstream-unavailable',
        }
      ),
      initialPanelKey: 'lider',
    })

    expect(
      await screen.findByRole('button', {
        name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
      })
    ).not.toBeNull()
    expect(screen.getByText(/Datos desactualizados/)).not.toBeNull()
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

    const badge = await screen.findByLabelText(
      'Demo pública con datos sintéticos'
    )

    expect(badge.textContent).toBe('Demo público · datos sintéticos')
    expect(badge.getAttribute('title')).toContain('estabilidad y seguridad')
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
})
