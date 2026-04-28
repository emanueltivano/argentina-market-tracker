export interface PanelTitulo {
  simbolo: string
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
  cantidadOperaciones?: number
}

export interface PanelSuccessResponse {
  ok: true
  data: PanelTitulo[]
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

function isPanelTitulo(value: unknown): value is PanelTitulo {
  return isRecord(value) && typeof value.simbolo === 'string'
}

function extractArrayPayload(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data

  if (!isRecord(data)) return null

  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.titulos)) return data.titulos

  return null
}

export function normalizePanelData(data: unknown): PanelTitulo[] {
  const payload = extractArrayPayload(data)

  if (!payload) {
    throw new Error('Invalid upstream payload structure')
  }

  const validItems = payload.filter(isPanelTitulo)

  if (payload.length > 0 && validItems.length === 0) {
    throw new Error('Upstream payload contains no valid items')
  }

  return validItems
}