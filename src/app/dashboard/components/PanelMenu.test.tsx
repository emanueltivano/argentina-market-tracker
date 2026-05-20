// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PanelMenu from './PanelMenu'
import { MARKET_PANEL_OPTIONS } from '../lib/marketPanelOptions'

describe('PanelMenu', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a decorative star only on the Favorites panel button', () => {
    render(
      <PanelMenu
        activePanelKey="lider"
        onChange={vi.fn()}
        options={MARKET_PANEL_OPTIONS}
      />
    )

    const favoritesButton = screen.getByRole('button', {
      name: 'Mostrar panel Favoritos',
    })
    const liderButton = screen.getByRole('button', {
      name: 'Mostrar panel Panel Líder',
    })

    expect(within(favoritesButton).getByText('☆').getAttribute('aria-hidden')).toBe(
      'true'
    )
    expect(within(favoritesButton).getByText('Favoritos')).not.toBeNull()
    expect(within(liderButton).queryByText('☆')).toBeNull()
  })

  it('opens and closes the mobile menu from the hamburger button', async () => {
    render(
      <PanelMenu
        activePanelKey="lider"
        onChange={vi.fn()}
        options={MARKET_PANEL_OPTIONS}
      />
    )

    const toggle = screen.getByRole('button', {
      name: 'Abrir navegación de paneles',
    })

    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-controls')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar navegación de paneles' })).not.toBeNull()
    const mobileNav = screen
      .getAllByRole('navigation', { name: 'Paneles de mercado' })
      .at(-1)!

    expect(document.activeElement).toBe(within(mobileNav).getAllByRole('button')[0])

    await userEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })

  it('closes the mobile menu after selecting a panel', async () => {
    const onChange = vi.fn()

    render(
      <PanelMenu
        activePanelKey="lider"
        onChange={onChange}
        options={MARKET_PANEL_OPTIONS}
      />
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Mostrar panel Panel General' }).at(-1)!
    )

    expect(onChange).toHaveBeenCalledWith('general')
    expect(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
        .getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('closes the mobile menu when clicking outside', async () => {
    render(
      <>
        <button type="button">Fuera</button>
        <PanelMenu
          activePanelKey="lider"
          onChange={vi.fn()}
          options={MARKET_PANEL_OPTIONS}
        />
      </>
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }))

    expect(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
        .getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('closes the mobile menu when the viewport returns to desktop', async () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined
    const matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn((event: string, handler: typeof changeHandler) => {
        if (event === 'change') {
          changeHandler = handler
        }
      }),
      removeEventListener: vi.fn(),
    })

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    })

    render(
      <PanelMenu
        activePanelKey="lider"
        onChange={vi.fn()}
        options={MARKET_PANEL_OPTIONS}
      />
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
    )

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent)
    })

    expect(
      screen.getByRole('button', { name: 'Abrir navegación de paneles' })
        .getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('closes the mobile menu when pressing Escape and returns focus to the toggle', async () => {
    render(
      <PanelMenu
        activePanelKey="lider"
        onChange={vi.fn()}
        options={MARKET_PANEL_OPTIONS}
      />
    )

    const toggle = screen.getByRole('button', {
      name: 'Abrir navegación de paneles',
    })

    await userEvent.click(toggle)
    await userEvent.keyboard('{Escape}')

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })
})
