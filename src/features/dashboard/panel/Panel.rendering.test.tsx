// @vitest-environment jsdom
import { memo } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stockRenderCounts = new Map<string, number>()

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/features/dashboard/history/useStockHistory', () => ({
  useStockHistory: () => ({
    points: [],
    error: undefined,
    isLoading: false,
    isRefreshing: false,
    viewStatus: 'empty',
  }),
}))

vi.mock('@/features/dashboard/stocks/Stock', () => ({
  default: memo(function MockStock(props: {
    ticker: string
    description: string
    isFavorite?: boolean
    onSelect?: (stock: { ticker: string; description: string }) => void
    onToggleFavorite?: (stock: { ticker: string; description: string }) => void
  }) {
    stockRenderCounts.set(
      props.ticker,
      (stockRenderCounts.get(props.ticker) ?? 0) + 1
    )

    return (
      <tr data-symbol={props.ticker}>
        <td>{props.ticker}</td>
        <td>
          <button
            type="button"
            onClick={() =>
              props.onSelect?.({
                ticker: props.ticker,
                description: props.description,
              })
            }
          >
            Abrir detalle de {props.ticker}, {props.description}
          </button>
        </td>
        <td>
          <button
            type="button"
            aria-label={
              props.isFavorite
                ? `Quitar ${props.ticker} de favoritos`
                : `Agregar ${props.ticker} a favoritos`
            }
            onClick={() =>
              props.onToggleFavorite?.({
                ticker: props.ticker,
                description: props.description,
              })
            }
          />
        </td>
      </tr>
    )
  }),
}))

import Panel from './Panel'

function panelResponse() {
  return {
    ok: true as const,
    data: [
      { simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' },
      { simbolo: 'YPFD', descripcion: 'YPF' },
    ],
    fetchedAt: '2026-05-04T16:00:00.000Z',
    servedAt: '2026-05-04T16:00:00.000Z',
    cacheStatus: 'fresh' as const,
  }
}

function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Panel initialData={panelResponse()} initialPanelKey="lider" />
    </SWRConfig>
  )
}

describe('Panel rendering stability', () => {
  beforeEach(() => {
    stockRenderCounts.clear()
    window.localStorage.clear()
  })

  it('avoids rerendering unrelated stock rows when a favorite changes', async () => {
    renderPanel()

    await screen.findByRole('button', { name: 'Agregar GGAL a favoritos' })

    const initialGgalRenders = stockRenderCounts.get('GGAL') ?? 0
    const initialYpfdRenders = stockRenderCounts.get('YPFD') ?? 0

    expect(initialGgalRenders).toBeGreaterThan(0)
    expect(initialYpfdRenders).toBeGreaterThan(0)

    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar GGAL a favoritos' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Quitar GGAL de favoritos' })
      ).toBeDefined()
    })
    expect(stockRenderCounts.get('GGAL')).toBe(initialGgalRenders + 1)
    expect(stockRenderCounts.get('YPFD')).toBe(initialYpfdRenders)
  })
})
