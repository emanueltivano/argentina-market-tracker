// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StockHistoryChart from './StockHistoryChart'

describe('StockHistoryChart', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders an empty state without placeholder dashes or invalid SVG values', () => {
    const { container } = render(<StockHistoryChart points={[]} symbol="AAPL" />)

    expect(screen.getByText('Sin histórico disponible')).not.toBeNull()
    expect(container.textContent).not.toContain('-')
    expect(container.innerHTML).not.toContain('Infinity')
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('handles a single historical point without invalid SVG values', () => {
    const { container } = render(
      <StockHistoryChart
        symbol="GGAL"
        points={[{ date: '2026-05-07', close: 101 }]}
      />
    )

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.innerHTML).not.toContain('Infinity')
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('handles equal prices without invalid SVG values', () => {
    const { container } = render(
      <StockHistoryChart
        symbol="YPFD"
        points={[
          { date: '2026-05-06', close: 101 },
          { date: '2026-05-07', close: 101 },
        ]}
      />
    )

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.innerHTML).not.toContain('Infinity')
    expect(container.innerHTML).not.toContain('NaN')
  })
})
