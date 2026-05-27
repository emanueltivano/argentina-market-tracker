export interface PanelTitulo {
  simbolo: string
  descripcion: string
  puntas?: {
    cantidadCompra?: number
    precioCompra?: number
    precioVenta?: number
    cantidadVenta?: number
  }
  ultimoPrecio?: number
  variacionPorcentual?: number
  apertura?: number
  maximo?: number
  minimo?: number
  ultimoCierre?: number
  volumen?: number
}

export interface PanelSuccessResponse {
  ok: true
  data: PanelTitulo[]
  fetchedAt: string
  servedAt: string
  cacheStatus: 'fresh' | 'memory-cache'
}

export const PANEL_ERROR_CODES = [
  'PANEL_ERROR',
  'RATE_LIMITED',
  'REFRESH_COOLDOWN',
  'METHOD_NOT_ALLOWED',
  'INVALID_PANEL_TYPE',
] as const

export type PanelErrorCode = (typeof PANEL_ERROR_CODES)[number]

export interface PanelErrorResponse {
  ok: false
  error: PanelErrorCode
  requestId?: string
  details?: string
}

export type PanelResponse = PanelSuccessResponse | PanelErrorResponse

export interface PanelNormalizationIssue {
  reason: string
}

export interface PanelNormalizationResult {
  data: PanelTitulo[]
  droppedItemsCount: number
  droppedItemsSummary: PanelNormalizationIssue[]
}

export interface QuoteNormalizationOptions {
  symbol: string
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

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const parsedValue = Number(trimmedValue.replace(/,/g, ''))

  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function isPanelErrorCode(value: unknown): value is PanelErrorCode {
  return (
    typeof value === 'string' &&
    PANEL_ERROR_CODES.includes(value as PanelErrorCode)
  )
}

export function isOptionalFiniteNumber(
  value: unknown
): value is number | undefined {
  return value === undefined || isFiniteNumber(value)
}

function hasPanelTituloIdentity(
  value: unknown
): value is Record<'simbolo' | 'descripcion', string> & Record<string, unknown> {
  return (
    isRecord(value) &&
    isNonEmptyString(value.simbolo) &&
    isNonEmptyString(value.descripcion)
  )
}

function extractArrayPayload(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data

  if (!isRecord(data)) return null

  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.titulos)) return data.titulos

  return null
}

type NumericPanelField = Exclude<
  keyof PanelTitulo,
  'simbolo' | 'descripcion' | 'puntas'
>

type PuntaField = keyof NonNullable<PanelTitulo['puntas']>

export const NUMERIC_PANEL_FIELDS = [
  'ultimoPrecio',
  'variacionPorcentual',
  'apertura',
  'maximo',
  'minimo',
  'ultimoCierre',
  'volumen',
] as const satisfies readonly NumericPanelField[]

export const PUNTA_FIELDS = [
  'cantidadCompra',
  'precioCompra',
  'precioVenta',
  'cantidadVenta',
] as const satisfies readonly PuntaField[]

export function isPanelTitulo(value: unknown): value is PanelTitulo {
  if (!hasPanelTituloIdentity(value)) {
    return false
  }

  for (const field of NUMERIC_PANEL_FIELDS) {
    if (!isOptionalFiniteNumber(value[field])) {
      return false
    }
  }

  const puntas = value.puntas

  if (puntas === undefined) {
    return true
  }

  if (!isRecord(puntas)) {
    return false
  }

  return PUNTA_FIELDS.every((field) => isOptionalFiniteNumber(puntas[field]))
}

function setFiniteNumber(
  target: PanelTitulo,
  field: NumericPanelField,
  value: unknown
) {
  const numericValue = toFiniteNumber(value)

  if (numericValue !== null) {
    target[field] = numericValue
  }
}

function setFinitePuntaNumber(
  target: NonNullable<PanelTitulo['puntas']>,
  field: PuntaField,
  value: unknown
) {
  const numericValue = toFiniteNumber(value)

  if (numericValue !== null) {
    target[field] = numericValue
  }
}

function normalizePuntas(value: unknown): PanelTitulo['puntas'] {
  if (!isRecord(value)) {
    return undefined
  }

  const puntas: NonNullable<PanelTitulo['puntas']> = {}

  setFinitePuntaNumber(puntas, 'cantidadCompra', value.cantidadCompra)
  setFinitePuntaNumber(puntas, 'precioCompra', value.precioCompra)
  setFinitePuntaNumber(puntas, 'precioVenta', value.precioVenta)
  setFinitePuntaNumber(puntas, 'cantidadVenta', value.cantidadVenta)

  return Object.keys(puntas).length > 0 ? puntas : undefined
}

type NormalizePanelTituloResult =
  | { ok: true; data: PanelTitulo }
  | { ok: false; reason: string }

function parsePanelTitulo(value: unknown): NormalizePanelTituloResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'INVALID_ITEM_SHAPE' }
  }

  if (!isNonEmptyString(value.simbolo) || !isNonEmptyString(value.descripcion)) {
    return { ok: false, reason: 'INVALID_IDENTITY' }
  }

  for (const field of NUMERIC_PANEL_FIELDS) {
    if (!isOptionalFiniteNumber(value[field])) {
      return { ok: false, reason: `INVALID_NUMERIC_FIELD:${field}` }
    }
  }

  if (value.puntas !== undefined) {
    if (!isRecord(value.puntas)) {
      return { ok: false, reason: 'INVALID_PUNTAS_SHAPE' }
    }

    for (const field of PUNTA_FIELDS) {
      if (!isOptionalFiniteNumber(value.puntas[field])) {
        return { ok: false, reason: `INVALID_PUNTA_FIELD:${field}` }
      }
    }
  }

  const item: PanelTitulo = {
    simbolo: value.simbolo,
    descripcion: value.descripcion,
  }

  const puntas = normalizePuntas(value.puntas)

  if (puntas) {
    item.puntas = puntas
  }

  setFiniteNumber(item, 'ultimoPrecio', value.ultimoPrecio)
  setFiniteNumber(item, 'variacionPorcentual', value.variacionPorcentual)
  setFiniteNumber(item, 'apertura', value.apertura)
  setFiniteNumber(item, 'maximo', value.maximo)
  setFiniteNumber(item, 'minimo', value.minimo)
  setFiniteNumber(item, 'ultimoCierre', value.ultimoCierre)
  setFiniteNumber(item, 'volumen', value.volumen)

  return {
    ok: true,
    data: item,
  }
}

function summarizeDroppedItems(reasons: string[]): PanelNormalizationIssue[] {
  const counts = new Map<string, number>()

  for (const reason of reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason, count]) => ({
      reason: `${reason}:${count}`,
    }))
}

export function normalizePanelDataResult(data: unknown): PanelNormalizationResult {
  const payload = extractArrayPayload(data)

  if (!payload) {
    throw new Error('Invalid upstream payload structure')
  }

  const validItems: PanelTitulo[] = []
  const droppedReasons: string[] = []

  for (const item of payload) {
    const parsedItem = parsePanelTitulo(item)

    if (parsedItem.ok) {
      validItems.push(parsedItem.data)
    } else {
      droppedReasons.push(parsedItem.reason)
    }
  }

  if (payload.length > 0 && validItems.length === 0) {
    throw new Error('Upstream payload contains no valid items')
  }

  return {
    data: validItems,
    droppedItemsCount: droppedReasons.length,
    droppedItemsSummary: summarizeDroppedItems(droppedReasons),
  }
}

export function normalizePanelData(data: unknown): PanelTitulo[] {
  return normalizePanelDataResult(data).data
}

function normalizeQuotePuntas(value: unknown): PanelTitulo['puntas'] {
  if (Array.isArray(value)) {
    return normalizePuntas(value[0])
  }

  return normalizePuntas(value)
}

export function normalizeQuoteData(
  data: unknown,
  options: QuoteNormalizationOptions
): PanelTitulo {
  if (!isRecord(data)) {
    throw new Error('Invalid upstream quote payload structure')
  }

  const descripcion =
    typeof data.descripcion === 'string' && data.descripcion.trim().length > 0
      ? data.descripcion
      : typeof data.descripcionTitulo === 'string' &&
          data.descripcionTitulo.trim().length > 0
        ? data.descripcionTitulo
        : null

  if (!descripcion) {
    throw new Error('Upstream quote payload contains no valid item')
  }

  const item: PanelTitulo = {
    simbolo: options.symbol,
    descripcion,
  }
  const puntas = normalizeQuotePuntas(data.puntas)

  if (puntas) {
    item.puntas = puntas
  }

  setFiniteNumber(item, 'ultimoPrecio', data.ultimoPrecio)
  setFiniteNumber(
    item,
    'variacionPorcentual',
    data.variacionPorcentual ?? data.variacion
  )
  setFiniteNumber(item, 'apertura', data.apertura)
  setFiniteNumber(item, 'maximo', data.maximo)
  setFiniteNumber(item, 'minimo', data.minimo)
  setFiniteNumber(item, 'ultimoCierre', data.ultimoCierre ?? data.cierreAnterior)
  setFiniteNumber(item, 'volumen', data.volumen ?? data.volumenNominal)

  return item
}
