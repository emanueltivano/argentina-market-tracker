import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCachedToken,
  clearCachedTokenIfMatches,
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

  it('clears a cached token only when it matches the rejected token', () => {
    setCachedToken('token-1')

    expect(clearCachedTokenIfMatches('token-1')).toBe(true)
    expect(getCachedToken()).toBeNull()
  })

  it('does not clear a newer cached token', () => {
    setCachedToken('token-2')

    expect(clearCachedTokenIfMatches('token-1')).toBe(false)
    expect(getCachedToken()).toBe('token-2')
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

  it('shares a failed renewal and permits a later renewal attempt', async () => {
    let rejectRenewal!: (reason: Error) => void
    const failedRenewal = new Promise<string>((_resolve, reject) => {
      rejectRenewal = reject
    })
    const fetchToken = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(failedRenewal)
      .mockResolvedValueOnce('recovered-token')

    const first = getOrCreateToken(fetchToken)
    const second = getOrCreateToken(fetchToken)
    rejectRenewal(new Error('shared renewal failed'))

    await expect(first).rejects.toThrow('shared renewal failed')
    await expect(second).rejects.toThrow('shared renewal failed')
    await expect(getOrCreateToken(fetchToken)).resolves.toBe('recovered-token')
    expect(fetchToken).toHaveBeenCalledTimes(2)
  })
})
