export const STOCK_HISTORY_RANGES = ['1W', '1M', '3M', '6M', '1Y'] as const

export type StockHistoryRange = (typeof STOCK_HISTORY_RANGES)[number]
export const DEFAULT_STOCK_HISTORY_RANGE: StockHistoryRange = '1M'
export const STOCK_HISTORY_MARKETS = ['bCBA'] as const
export type StockHistoryMarket = (typeof STOCK_HISTORY_MARKETS)[number]
export const DEFAULT_STOCK_HISTORY_MARKET: StockHistoryMarket = 'bCBA'

export interface StockHistoryPoint {
  date: string
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

export interface StockHistorySuccessResponse {
  ok: true
  data: StockHistoryPoint[]
  fetchedAt: string
  servedAt: string
  cacheStatus: 'fresh' | 'memory-cache'
  range: StockHistoryRange
  market: StockHistoryMarket
  symbol: string
  meta: StockHistoryResponseMeta
}

export interface StockHistoryResponseMeta {
  discardedPoints: number
  requestId?: string
  source: 'demo' | 'live'
  stale: boolean
  totalPoints: number
}

export const STOCK_HISTORY_ERROR_CODES = [
  'HISTORY_ERROR',
  'INVALID_SYMBOL',
  'INVALID_MARKET',
  'INVALID_RANGE',
  'RATE_LIMITED',
  'RATE_LIMIT_UNAVAILABLE',
  'METHOD_NOT_ALLOWED',
] as const

export type StockHistoryErrorCode = (typeof STOCK_HISTORY_ERROR_CODES)[number]

export interface StockHistoryErrorResponse {
  ok: false
  error: StockHistoryErrorCode
  requestId?: string
  details?: string
}

export type StockHistoryResponse =
  | StockHistorySuccessResponse
  | StockHistoryErrorResponse

export function isStockHistoryMarket(
  value: string | null
): value is StockHistoryMarket {
  return (
    typeof value === 'string' &&
    STOCK_HISTORY_MARKETS.includes(value as StockHistoryMarket)
  )
}

export function buildStockHistoryApiPath(
  symbol: string,
  range: StockHistoryRange,
  market: StockHistoryMarket
): string {
  const params = new URLSearchParams({
    range,
    market,
  })

  return `/api/stocks/${encodeURIComponent(symbol)}/history?${params.toString()}`
}

const FIELD_ALIASES = {
  date: ['fecha', 'date', 'fechaHora', 'fechaCotizacion'],
  close: [
    'ultimoPrecio',
    'cierre',
    'close',
    'precio',
    'precioCierre',
    'precioAjustado',
    'cierreAjustado',
  ],
  open: ['apertura', 'open', 'precioApertura'],
  high: ['maximo', 'high', 'precioMaximo'],
  low: ['minimo', 'low', 'precioMinimo'],
  volume: ['volumen', 'volume', 'cantidadOperaciones', 'volumenNominal'],
} as const

const ARRAY_PAYLOAD_FIELDS = ['data', 'cotizaciones', 'serie'] as const

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function getFirstField(
  value: Record<string, unknown>,
  fields: readonly string[]
): unknown {
  const directMatch = fields.find((field) => field in value)

  if (directMatch) {
    return value[directMatch]
  }

  const normalizedFields = new Set(fields.map(normalizeFieldName))
  const matchingKey = Object.keys(value).find((key) =>
    normalizedFields.has(normalizeFieldName(key))
  )

  if (matchingKey) {
    return value[matchingKey]
  }

  return undefined
}

function parseNumberString(value: string): number | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const numericValue = trimmedValue.replace(/[^0-9,.-]/g, '')

  if (!numericValue || numericValue === '-' || numericValue === '.') {
    return null
  }

  const lastCommaIndex = numericValue.lastIndexOf(',')
  const lastDotIndex = numericValue.lastIndexOf('.')
  const singleSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex)
  const singleSeparator =
    lastCommaIndex === -1 && lastDotIndex !== -1
      ? '.'
      : lastDotIndex === -1 && lastCommaIndex !== -1
        ? ','
        : null
  const hasSingleThousandsSeparator =
    singleSeparator !== null &&
    numericValue.slice(singleSeparatorIndex + 1).length === 3 &&
    /^\d{1,3}$/.test(numericValue.slice(0, singleSeparatorIndex))

  if (hasSingleThousandsSeparator) {
    const parsedValue = Number(numericValue.replace(singleSeparator, ''))

    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  const decimalSeparator =
    lastCommaIndex > lastDotIndex
      ? ','
      : lastDotIndex > lastCommaIndex
        ? '.'
        : null
  const normalizedValue =
    decimalSeparator === ','
      ? numericValue.replace(/\./g, '').replace(',', '.')
      : numericValue.replace(/,/g, '')
  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value
  }

  if (typeof value === 'string') {
    return parseNumberString(value)
  }

  return null
}

function formatDateParts(year: string, month: string, day: string): string | null {
  const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? normalizedDate : null
}

function normalizeObjectKeys(value: Record<string, unknown>): Record<string, string[]> {
  return Object.keys(value).reduce<Record<string, string[]>>((keys, key) => {
    const normalizedKey = normalizeFieldName(key)

    keys[normalizedKey] = [...(keys[normalizedKey] ?? []), key]
    return keys
  }, {})
}

function extractArrayPayload(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data

  if (!isRecord(data)) return null

  for (const field of ARRAY_PAYLOAD_FIELDS) {
    if (Array.isArray(data[field])) return data[field]
  }

  const normalizedKeys = normalizeObjectKeys(data)

  for (const field of ARRAY_PAYLOAD_FIELDS) {
    const matchingKeys = normalizedKeys[normalizeFieldName(field)] ?? []
    const matchingArray = matchingKeys
      .map((key) => data[key])
      .find((value) => Array.isArray(value))

    if (Array.isArray(matchingArray)) return matchingArray
  }

  return null
}

function normalizeDate(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null
  }

  const trimmedValue = value.trim()
  const isoDate = trimmedValue.slice(0, 10)

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate
  }

  const localDateMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)

  if (localDateMatch) {
    const [, day, month, year] = localDateMatch

    return formatDateParts(year, month, day)
  }

  return null
}

function setOptionalNumber(
  point: StockHistoryPoint,
  field: keyof Omit<StockHistoryPoint, 'date' | 'close'>,
  value: unknown
) {
  const numberValue = toFiniteNumber(value)

  if (numberValue !== null) {
    point[field] = numberValue
  }
}

function normalizeHistoryPoint(value: unknown): StockHistoryPoint | null {
  if (!isRecord(value)) {
    return null
  }

  const date = normalizeDate(getFirstField(value, FIELD_ALIASES.date))
  const close = toFiniteNumber(getFirstField(value, FIELD_ALIASES.close))

  if (!date || close === null) {
    return null
  }

  const point: StockHistoryPoint = {
    date,
    close,
  }

  setOptionalNumber(point, 'open', getFirstField(value, FIELD_ALIASES.open))
  setOptionalNumber(point, 'high', getFirstField(value, FIELD_ALIASES.high))
  setOptionalNumber(point, 'low', getFirstField(value, FIELD_ALIASES.low))
  setOptionalNumber(point, 'volume', getFirstField(value, FIELD_ALIASES.volume))

  return point
}

export interface StockHistoryNormalizationResult {
  data: StockHistoryPoint[]
  discardedPoints: number
  totalPoints: number
}

export function normalizeStockHistoryDataResult(
  data: unknown
): StockHistoryNormalizationResult {
  const payload = extractArrayPayload(data)

  if (!payload) {
    throw new Error('Invalid upstream history payload structure')
  }

  const normalizedItems = payload.map((item) => normalizeHistoryPoint(item))
  const invalidItemsCount = normalizedItems.filter((item) => item === null).length

  if (payload.length > 0 && invalidItemsCount === payload.length) {
    throw new Error('Upstream history payload contains no valid items')
  }

  return {
    data: normalizedItems.filter(isNotNull).sort((first, second) =>
      first.date.localeCompare(second.date)
    ),
    discardedPoints: invalidItemsCount,
    totalPoints: payload.length,
  }
}

export function normalizeStockHistoryData(data: unknown): StockHistoryPoint[] {
  return normalizeStockHistoryDataResult(data).data
}

export function isStockHistoryRange(
  value: string | null
): value is StockHistoryRange {
  return (
    typeof value === 'string' &&
    STOCK_HISTORY_RANGES.includes(value as StockHistoryRange)
  )
}

export function isStockHistoryErrorCode(
  value: unknown
): value is StockHistoryErrorCode {
  return (
    typeof value === 'string' &&
    STOCK_HISTORY_ERROR_CODES.includes(value as StockHistoryErrorCode)
  )
}

export function isStockHistoryPoint(value: unknown): value is StockHistoryPoint {
  return (
    isRecord(value) &&
    isNonEmptyString(value.date) &&
    isFiniteNumber(value.close) &&
    (value.open === undefined || isFiniteNumber(value.open)) &&
    (value.high === undefined || isFiniteNumber(value.high)) &&
    (value.low === undefined || isFiniteNumber(value.low)) &&
    (value.volume === undefined || isFiniteNumber(value.volume))
  )
}
