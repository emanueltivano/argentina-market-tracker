import { describe, expect, it } from 'vitest'
import { isMarketPanelKey } from './market'

describe('isMarketPanelKey', () => {
  it('accepts known market panel keys', () => {
    expect(isMarketPanelKey('lider')).toBe(true)
    expect(isMarketPanelKey('general')).toBe(true)
    expect(isMarketPanelKey('cedears')).toBe(true)
  })

  it('rejects invalid strings', () => {
    expect(isMarketPanelKey('')).toBe(false)
    expect(isMarketPanelKey('merval')).toBe(false)
    expect(isMarketPanelKey('LIDER')).toBe(false)
    expect(isMarketPanelKey(null)).toBe(false)
  })
})
