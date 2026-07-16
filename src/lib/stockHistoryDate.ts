const STOCK_HISTORY_CALENDAR_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/

export type ParsedStockHistoryCalendarDate = {
  date: string
  timestampMs: number
}

export function parseStockHistoryCalendarDate(
  value: unknown
): ParsedStockHistoryCalendarDate | null {
  if (typeof value !== 'string') {
    return null
  }

  const match = STOCK_HISTORY_CALENDAR_DATE_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const usesDateUtcCenturyOffset = year >= 0 && year <= 99
  const timestampMs = Date.UTC(
    usesDateUtcCenturyOffset ? 2000 : year,
    month - 1,
    day
  )
  const date = new Date(timestampMs)

  if (usesDateUtcCenturyOffset) {
    date.setUTCFullYear(year)
  }

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return {
    date: value,
    timestampMs: date.getTime(),
  }
}
