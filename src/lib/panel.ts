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

export interface PanelErrorResponse {
  ok: false
  error: string
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

function isPanelTitulo(
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

  const validItems = payload.flatMap((item) => {
    const normalizedItem = normalizePanelTitulo(item)

    return normalizedItem ? [normalizedItem] : []
  })

  if (payload.length > 0 && validItems.length === 0) {
    throw new Error('Upstream payload contains no valid items')
  }

  return validItems
}
