import {
  isFavoritesErrorCode,
  type FavoritesErrorCode,
  type FavoritesResponse,
} from '@/lib/favorites'
import { assertFavoritePanelSuccessResponse } from './favoritePanelValidation'

export type FavoritePanelSuccessResponse = Extract<
  FavoritesResponse,
  { ok: true }
>

type FavoritePanelErrorResponse = Extract<FavoritesResponse, { ok: false }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFavoritePanelErrorResponse(
  value: unknown
): value is FavoritePanelErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isFavoritesErrorCode(value.error)
  )
}

const FAVORITES_ERROR_MESSAGE: Record<FavoritesErrorCode, string> = {
  FAVORITES_ERROR: 'No se pudieron cargar las cotizaciones de favoritos.',
  INVALID_ITEMS: 'Favoritos inválidos.',
  TOO_MANY_ITEMS: 'Hay demasiados favoritos guardados.',
  RATE_LIMITED: 'Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.',
  RATE_LIMIT_UNAVAILABLE:
    'El control de rate limit no está disponible temporalmente. Intentá nuevamente en unos segundos.',
  METHOD_NOT_ALLOWED: 'Método no permitido para cargar favoritos.',
}

function favoriteRequestTarget(response: Response): string {
  return response.url ? ` (${response.url})` : ''
}

export async function getFavoritePanelFetchError(
  response: Response
): Promise<Error> {
  let json: unknown

  try {
    json = await response.json()
  } catch {
    return new Error(
      `Error del servidor (${response.status}) al cargar favoritos${favoriteRequestTarget(response)}.`
    )
  }

  if (!isFavoritePanelErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar favoritos${favoriteRequestTarget(response)}.`
    )
  }

  const message = FAVORITES_ERROR_MESSAGE[json.error]

  if (process.env.NODE_ENV !== 'production' && json.details) {
    return new Error(`${message} Detalle: ${json.details}`)
  }

  return new Error(message)
}

export async function fetchFavoritePanel(
  url: string
): Promise<FavoritePanelSuccessResponse> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw await getFavoritePanelFetchError(response)
  }

  let json: unknown

  try {
    json = await response.json()
  } catch {
    throw new Error(`Respuesta inválida del servidor al cargar favoritos: ${url}`)
  }

  assertFavoritePanelSuccessResponse(json)

  return json
}
