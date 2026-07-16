import { afterEach, describe, expect, it } from 'vitest'
import { parseStockHistoryCalendarDate } from './stockHistoryDate'

const ORIGINAL_TZ = process.env.TZ

describe('parseStockHistoryCalendarDate', () => {
  afterEach(() => {
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = ORIGINAL_TZ
    }
  })

  it.each([
    '2026-01-01',
    '2026-12-31',
    '2024-02-29',
    '2025-02-28',
    '2000-02-29',
    '0000-02-29',
    '0099-12-31',
    '9999-12-31',
  ])('accepts the real canonical date %s', (value) => {
    const parsed = parseStockHistoryCalendarDate(value)

    expect(parsed?.date).toBe(value)
    expect(Number.isFinite(parsed?.timestampMs)).toBe(true)
  })

  it.each([
    '2025-02-29',
    '2026-02-30',
    '2025-04-31',
    '2025-06-31',
    '2025-11-31',
    '2025-00-10',
    '2025-13-10',
    '2025-01-00',
    '2025-01-32',
    '2025-1-01',
    '25-01-01',
    '2025/01/01',
    '2025-01-01T00:00:00Z',
    ' 2025-01-01',
    '2025-01-01 ',
    '',
  ])('rejects the non-calendar or non-canonical value %j', (value) => {
    expect(parseStockHistoryCalendarDate(value)).toBeNull()
  })

  it.each([null, undefined, 20250101, {}, []])(
    'rejects the non-string value %j',
    (value) => {
      expect(parseStockHistoryCalendarDate(value)).toBeNull()
    }
  )

  it.each([
    ['1900-02-29', false],
    ['2000-02-29', true],
    ['2024-02-29', true],
    ['2100-02-29', false],
  ] as const)('applies Gregorian leap-year rules to %s', (value, valid) => {
    expect(parseStockHistoryCalendarDate(value) !== null).toBe(valid)
  })

  it('produces the same UTC timestamp independently of the local timezone', () => {
    process.env.TZ = 'Pacific/Kiritimati'
    const east = parseStockHistoryCalendarDate('2026-01-01')
    process.env.TZ = 'America/Los_Angeles'
    const west = parseStockHistoryCalendarDate('2026-01-01')

    expect(east).toEqual(west)
    expect(east?.timestampMs).toBe(Date.UTC(2026, 0, 1))
  })
})
