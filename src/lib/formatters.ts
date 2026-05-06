// Locale and decimal combinations are controlled by app formatters.
const numberFormatters = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  const cached = numberFormatters.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  numberFormatters.set(key, formatter);
  return formatter;
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  locale = 'es-AR',
): string {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return '—';
  }

  return getNumberFormatter(locale, decimals).format(numberValue);
}

export function formatMoney(value: number | null | undefined): string {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return '—';
  }

  return `$ ${formatNumber(numberValue)}`;
}

export function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0);
}

export function formatSignedPercent(
  value: number | null | undefined,
  decimals = 2,
): string {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return '—';
  }

  if (numberValue === 0) {
    return `${formatNumber(0, decimals)}%`;
  }

  const sign = numberValue > 0 ? '+ ' : '- ';
  return `${sign}${formatNumber(Math.abs(numberValue), decimals)}%`;
}
