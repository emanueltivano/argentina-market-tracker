import { type PanelTitulo } from '@/lib/panel';
import { type MarketPanelSuccessResponse } from './marketPanelClient';

const NUMERIC_PANEL_FIELDS = [
  'ultimoPrecio',
  'variacionPorcentual',
  'apertura',
  'maximo',
  'minimo',
  'ultimoCierre',
  'volumen',
] as const satisfies readonly (keyof PanelTitulo)[];

const PUNTA_FIELDS = [
  'cantidadCompra',
  'precioCompra',
  'precioVenta',
  'cantidadVenta',
] as const satisfies readonly (keyof NonNullable<PanelTitulo['puntas']>)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isPanelTitulo(value: unknown): value is PanelTitulo {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.simbolo) ||
    !isNonEmptyString(value.descripcion)
  ) {
    return false;
  }

  for (const field of NUMERIC_PANEL_FIELDS) {
    if (!isOptionalFiniteNumber(value[field])) {
      return false;
    }
  }

  const puntas = value.puntas;

  if (puntas === undefined) {
    return true;
  }

  if (!isRecord(puntas)) {
    return false;
  }

  return PUNTA_FIELDS.every((field) =>
    isOptionalFiniteNumber(puntas[field]),
  );
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

  if (
    typeof value.fetchedAt !== 'string' ||
    typeof value.servedAt !== 'string' ||
    (value.cacheStatus !== 'fresh' && value.cacheStatus !== 'memory-cache')
  ) {
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
