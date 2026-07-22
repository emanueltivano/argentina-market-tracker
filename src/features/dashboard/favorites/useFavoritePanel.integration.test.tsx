// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { useFavoritePanel } from './useFavoritePanel'

function wrapper({ children }: PropsWithChildren) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  )
}

describe('useFavoritePanel enabled lifecycle', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not fetch or poll while disabled and stops again after disabling', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        ok: true,
        rows: [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
        missingItems: [],
        failedItems: [],
        source: 'demo',
        requestId: 'req-favorites-1234',
        updatedAt: '2026-05-04T16:00:00.000Z',
        servedAt: '2026-05-04T16:00:01.000Z',
        stale: false,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const items = [{ symbol: 'GGAL', market: 'bCBA' as const }]

    const { result, rerender } = renderHook(
      ({ enabled }) => useFavoritePanel(items, { enabled }),
      { initialProps: { enabled: false }, wrapper }
    )

    expect(result.current.viewStatus).toBe('empty')
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/favorites?items=bCBA%3AGGAL', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    rerender({ enabled: false })
    expect(result.current.viewStatus).toBe('empty')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
