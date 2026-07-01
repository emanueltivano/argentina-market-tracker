// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupPanelTest,
  panelResponse,
  push,
  renderPanel,
  setupPanelTest,
  tabUntilFocus,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel modal', () => {
  function mockMobileViewport(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches,
        media: '(max-width: 767px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  }

  it('opens the modal by keyboard and restores focus after Escape', async () => {
    mockMobileViewport(false)
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

  it('navigates to the stock detail page on mobile instead of opening the modal', async () => {
    mockMobileViewport(true)
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

    const opener = await screen.findByRole('button', {
      name: 'Abrir detalle de GGAL, Grupo Financiero Galicia',
    })

    await waitFor(() => {
      expect(opener.getAttribute('aria-haspopup')).toBeNull()
    })

    await tabUntilFocus(opener)
    expect(document.activeElement).toBe(opener)
    await userEvent.keyboard('{Enter}')

    expect(push).toHaveBeenCalledWith('/stocks/GGAL')
    expect(screen.queryByRole('dialog', { name: 'GGAL' })).toBeNull()
  })
})
