// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PanelLoadingSkeleton from './PanelLoadingSkeleton'

describe('PanelLoadingSkeleton', () => {
  it('renders visual skeletons with an accessible loading status', () => {
    render(<PanelLoadingSkeleton />)

    expect(screen.queryByText('Cargando panel...')).toBeNull()
    expect(screen.getByText('Cargando panel')).not.toBeNull()
    expect(screen.getAllByTestId('stock-table-skeleton-row')).toHaveLength(6)
    expect(
      document.querySelector('.panel-skeleton-icon')?.closest(
        '.dashboard-floating-actions'
      )
    ).not.toBeNull()
  })
})
