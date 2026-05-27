// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFavoritePanel } from './useFavoritePanel'

const { mutateMock, useSWRMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useSWRMock: vi.fn(),
}))

vi.mock('swr', () => ({
  default: useSWRMock,
}))

describe('useFavoritePanel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes failedItems separately from missingItems', () => {
    mutateMock.mockResolvedValue(undefined)
    useSWRMock.mockReturnValue({
      data: {
        ok: true,
        rows: [{ simbolo: 'GGAL', descripcion: 'Grupo Financiero Galicia' }],
        missingItems: ['bCBA:DEMOX'],
        failedItems: ['bCBA:AGRO'],
        source: 'live',
        requestId: 'req-favorites-1234',
        updatedAt: '2026-05-04T16:00:00.000Z',
        servedAt: '2026-05-04T16:00:01.000Z',
        stale: false,
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateMock,
    })

    const { result } = renderHook(() =>
      useFavoritePanel([{ symbol: 'GGAL', market: 'bCBA' }])
    )

    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/favorites?items=bCBA%3AGGAL',
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: false,
        revalidateOnMount: true,
      })
    )
    expect(result.current.missingItems).toEqual(['bCBA:DEMOX'])
    expect(result.current.failedItems).toEqual(['bCBA:AGRO'])
  })
})
