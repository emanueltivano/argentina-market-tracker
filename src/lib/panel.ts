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
  details?: string
}

export type PanelResponse = PanelSuccessResponse | PanelErrorResponse

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

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
  if (isFiniteNumber(value)) {
    target[field] = value
  }
}

function setFinitePuntaNumber(
  target: NonNullable<PanelTitulo['puntas']>,
  field: PuntaField,
  value: unknown
) {
  if (isFiniteNumber(value)) {
    target[field] = value
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

function normalizePanelTitulo(value: unknown): PanelTitulo | null {
  if (!isPanelTitulo(value)) {
    return null
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

  return item
}

export function normalizePanelData(data: unknown): PanelTitulo[] {
  const payload = extractArrayPayload(data)

  if (!payload) {
    throw new Error('Invalid upstream payload structure')
  }

  const normalizedItems = payload.map((item) => normalizePanelTitulo(item))
  const invalidItemsCount = normalizedItems.filter((item) => item === null).length

  if (payload.length > 0 && invalidItemsCount === payload.length) {
    throw new Error('Upstream payload contains no valid items')
  }

  if (invalidItemsCount > 0) {
    throw new Error('Upstream payload contains partially invalid items')
  }

  return normalizedItems.filter(isNotNull)
}
