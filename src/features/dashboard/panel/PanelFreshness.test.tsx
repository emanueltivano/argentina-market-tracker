// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PanelFreshness from './PanelFreshness'

describe('PanelFreshness', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders compact freshness text with the complete timestamp available', () => {
    render(
      <PanelFreshness
        fetchedAt="2026-05-04T16:00:00.000Z"
        isRefreshing={false}
      />
    )

    const freshness = screen.getByText(/Actualizado/)

    expect(freshness).not.toBeNull()
    expect(freshness.closest('[title^="Última actualización:"]')).not.toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('announces passive revalidation without exposing an action', () => {
    render(
      <PanelFreshness
        fetchedAt="2026-05-04T16:00:00.000Z"
        isRefreshing
      />
    )

    const freshness = screen.getByText('Actualizando...').closest('p')

    expect(freshness?.getAttribute('aria-busy')).toBe('true')
    expect(freshness?.getAttribute('aria-label')).toContain('Actualizando datos')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a textual stale warning with the last update time', () => {
    render(
      <PanelFreshness
        fetchedAt="2026-05-04T16:00:00.000Z"
        isRefreshing={false}
        stale
      />
    )

    const freshness = screen.getByText(/Datos desactualizados/).closest('p')

    expect(freshness?.textContent).toContain('Actualizado')
    expect(freshness?.getAttribute('aria-label')).toContain(
      'Datos posiblemente desactualizados'
    )
    expect(freshness?.getAttribute('data-stale')).toBe('true')
  })
})
