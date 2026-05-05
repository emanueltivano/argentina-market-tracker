// @vitest-environment jsdom
import { SWRConfig } from 'swr'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from './Panel'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
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

describe('Panel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the initial loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    renderPanel()

    expect(screen.getByText('Cargando datos...')).not.toBeNull()
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

  it('renders rows and refreshes manually with a cache bypass request', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    expect(
      await screen.findByRole('button', { name: 'Abrir detalle de YPFD, YPF' })
    ).not.toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/panel?type=lider&refresh=1', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
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

    expect(replace).toHaveBeenCalledWith('/?panel=general', {
      scroll: false,
    })
  })
})
