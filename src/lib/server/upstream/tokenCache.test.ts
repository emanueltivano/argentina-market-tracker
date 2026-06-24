import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCachedToken,
  clearInFlightTokenRequest,
  getCachedToken,
  getOrCreateToken,
  setCachedToken,
} from './tokenCache'

describe('token cache', () => {
  beforeEach(() => {
    clearCachedToken()
    clearInFlightTokenRequest()
  })

  it('reuses cached tokens', async () => {
    const fetchToken = vi.fn(async () => 'fresh-token')

    setCachedToken('cached-token')

    await expect(getOrCreateToken(fetchToken)).resolves.toBe('cached-token')
    expect(fetchToken).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent token requests in flight', async () => {
    let resolveToken!: (token: string) => void
    const fetchToken = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve
        })
    )

    const first = getOrCreateToken(fetchToken)
    const second = getOrCreateToken(fetchToken)

    resolveToken('shared-token')

    await expect(Promise.all([first, second])).resolves.toEqual([
      'shared-token',
      'shared-token',
    ])
    expect(fetchToken).toHaveBeenCalledTimes(1)
    expect(getCachedToken()).toBeNull()
  })

  it('clears the in-flight request after a failure', async () => {
    const fetchToken = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('upstream failed'))
      .mockResolvedValueOnce('fresh-token')

    await expect(getOrCreateToken(fetchToken)).rejects.toThrow('upstream failed')
    await expect(getOrCreateToken(fetchToken)).resolves.toBe('fresh-token')

    expect(fetchToken).toHaveBeenCalledTimes(2)
  })
})
