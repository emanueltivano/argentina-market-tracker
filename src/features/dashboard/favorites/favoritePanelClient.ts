import {
  isFavoritesErrorCode,
  isFavoritesSuccessResponse,
  type FavoritesErrorCode,
  type FavoritesResponse,
} from '@/lib/favorites'
import {
  fetchValidatedJson,
  isJsonRecord,
  responseUrlSuffix,
} from '@/features/dashboard/shared/fetchJsonClient'

export type FavoritePanelSuccessResponse = Extract<
  FavoritesResponse,
  { ok: true }
>

type FavoritePanelErrorResponse = Extract<FavoritesResponse, { ok: false }>

function assertFavoritePanelSuccessResponse(
  value: unknown
): asserts value is FavoritePanelSuccessResponse {
  if (!isFavoritesSuccessResponse(value)) {
    throw new Error(
      'Respuesta inválida del servidor: contrato de éxito de favoritos inválido.'
    )
  }
}

function isFavoritePanelErrorResponse(
  value: unknown
): value is FavoritePanelErrorResponse {
  return (
    isJsonRecord(value) &&
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

export async function getFavoritePanelFetchError(
  response: Response
): Promise<Error> {
  let json: unknown

  try {
    json = await response.json()
  } catch {
    return new Error(
      `Error del servidor (${response.status}) al cargar favoritos${responseUrlSuffix(response)}.`
    )
  }

  if (!isFavoritePanelErrorResponse(json)) {
    return new Error(
      `Error del servidor (${response.status}) al cargar favoritos${responseUrlSuffix(response)}.`
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
  return fetchValidatedJson(url, {
    assertSuccessResponse: assertFavoritePanelSuccessResponse,
    getError: getFavoritePanelFetchError,
    invalidJsonMessage: `Respuesta inválida del servidor al cargar favoritos: ${url}`,
  })
}
