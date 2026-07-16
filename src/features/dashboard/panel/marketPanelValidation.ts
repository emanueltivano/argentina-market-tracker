import { isPanelTitulo } from '@/lib/panel';
import { isValidFreshnessContract } from '@/lib/freshness';
import { type MarketPanelSuccessResponse } from './marketPanelClient';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMarketPanelSuccessValidationError(value: unknown): string | null {
  if (!isRecord(value) || value.ok !== true) {
    return 'Respuesta inválida del servidor: contrato de éxito inválido.';
  }

  if (!Array.isArray(value.data)) {
    return 'Respuesta inválida del servidor: data debe ser un array.';
  }

  if (!value.data.every(isPanelTitulo)) {
    return 'Respuesta inválida del servidor: item de panel inválido.';
  }

  if (!isValidFreshnessContract(value)) {
    return 'Respuesta inválida del servidor: metadata inválida.';
  }

  return null;
}

export function assertMarketPanelSuccessResponse(
  value: unknown,
): asserts value is MarketPanelSuccessResponse {
  const validationError = getMarketPanelSuccessValidationError(value);

  if (validationError) {
    throw new Error(validationError);
  }
}
