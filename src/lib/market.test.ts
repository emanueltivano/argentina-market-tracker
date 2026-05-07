import { describe, expect, it } from 'vitest'
import { isMarketDataPanelKey, isMarketPanelKey } from './market'

describe('isMarketPanelKey', () => {
  it('accepts known market panel keys', () => {
    expect(isMarketPanelKey('lider')).toBe(true)
    expect(isMarketPanelKey('general')).toBe(true)
    expect(isMarketPanelKey('cedears')).toBe(true)
    expect(isMarketPanelKey('favorites')).toBe(true)
  })

  it('rejects invalid strings', () => {
    expect(isMarketPanelKey('')).toBe(false)
    expect(isMarketPanelKey('merval')).toBe(false)
    expect(isMarketPanelKey('LIDER')).toBe(false)
    expect(isMarketPanelKey(null)).toBe(false)
  })
})

describe('isMarketDataPanelKey', () => {
  it('accepts only backend-backed market panel keys', () => {
    expect(isMarketDataPanelKey('lider')).toBe(true)
    expect(isMarketDataPanelKey('general')).toBe(true)
    expect(isMarketDataPanelKey('cedears')).toBe(true)
    expect(isMarketDataPanelKey('favorites')).toBe(false)
    expect(isMarketDataPanelKey(null)).toBe(false)
  })
})
