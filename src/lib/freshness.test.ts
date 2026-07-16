import { describe, expect, it } from 'vitest'
import { isServerIsoTimestamp, isValidFreshnessContract } from './freshness'

const fresh = {
  fetchedAt: '2026-07-15T15:00:00.000Z',
  servedAt: '2026-07-15T15:00:00.000Z',
  staleUntil: '2026-07-15T15:02:00.000Z',
  cacheStatus: 'fresh',
  stale: false,
}

describe('freshness contract', () => {
  it.each([
    ['fresh with stale true', { ...fresh, stale: true }],
    [
      'stale with stale false',
      {
        ...fresh,
        cacheStatus: 'stale',
        stale: false,
        degradationReason: 'upstream-unavailable',
      },
    ],
    [
      'memory-cache with stale true',
      { ...fresh, cacheStatus: 'memory-cache', stale: true },
    ],
    [
      'fresh with degradation reason',
      { ...fresh, degradationReason: 'upstream-unavailable' },
    ],
    [
      'memory-cache with degradation reason',
      {
        ...fresh,
        cacheStatus: 'memory-cache',
        degradationReason: 'upstream-unavailable',
      },
    ],
    ['stale without degradation reason', { ...fresh, cacheStatus: 'stale', stale: true }],
    ['invalid fetchedAt', { ...fresh, fetchedAt: '2026-02-30T15:00:00.000Z' }],
    ['invalid servedAt', { ...fresh, servedAt: '2026-07-15 15:00:00' }],
    ['invalid staleUntil', { ...fresh, staleUntil: 'later' }],
    [
      'served before fetched',
      { ...fresh, servedAt: '2026-07-15T14:59:59.999Z' },
    ],
    [
      'staleUntil equal to fetched',
      { ...fresh, staleUntil: fresh.fetchedAt },
    ],
    [
      'stale served after staleUntil',
      {
        ...fresh,
        servedAt: '2026-07-15T15:02:00.001Z',
        cacheStatus: 'stale',
        stale: true,
        degradationReason: 'upstream-unavailable',
      },
    ],
  ])('rejects %s', (_label, contract) => {
    expect(isValidFreshnessContract(contract)).toBe(false)
  })

  it.each([
    ['fresh', fresh],
    [
      'memory-cache',
      {
        ...fresh,
        servedAt: '2026-07-15T15:00:30.000Z',
        cacheStatus: 'memory-cache',
      },
    ],
    [
      'stale inside the window',
      {
        ...fresh,
        servedAt: '2026-07-15T15:01:59.999Z',
        cacheStatus: 'stale',
        stale: true,
        degradationReason: 'upstream-unavailable',
      },
    ],
  ])('accepts a coherent %s response', (_label, contract) => {
    expect(isValidFreshnessContract(contract)).toBe(true)
  })

  it('accepts only the complete UTC ISO format emitted by the server', () => {
    expect(isServerIsoTimestamp('2026-07-15T15:00:00.000Z')).toBe(true)
    expect(isServerIsoTimestamp('2026-07-15T15:00:00Z')).toBe(false)
    expect(isServerIsoTimestamp('2026-07-15T12:00:00.000-03:00')).toBe(false)
    expect(isServerIsoTimestamp('2026-02-30T15:00:00.000Z')).toBe(false)
  })
})
