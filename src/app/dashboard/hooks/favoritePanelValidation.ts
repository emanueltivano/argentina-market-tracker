import { isFavoritesSuccessResponse } from '@/lib/favorites'
import type { FavoritePanelSuccessResponse } from './favoritePanelClient'

export function assertFavoritePanelSuccessResponse(
  value: unknown
): asserts value is FavoritePanelSuccessResponse {
  if (!isFavoritesSuccessResponse(value)) {
    throw new Error(
      'Respuesta inválida del servidor: contrato de éxito de favoritos inválido.'
    )
  }
}
