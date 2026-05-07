// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
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
      name: 'Favoritos',
    })
    const liderButton = screen.getByRole('button', {
      name: 'Panel Líder',
    })

    expect(within(favoritesButton).getByText('★').getAttribute('aria-hidden')).toBe(
      'true'
    )
    expect(within(favoritesButton).getByText('Favoritos')).not.toBeNull()
    expect(within(liderButton).queryByText('★')).toBeNull()
  })
})
