// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupPanelTest,
  panelResponse,
  renderPanel,
  setupPanelTest,
  tabUntilFocus,
} from './Panel.testUtils'

beforeEach(setupPanelTest)
afterEach(cleanupPanelTest)

describe('Panel modal', () => {
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
})
