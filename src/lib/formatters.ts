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

export function formatQuantity(value: number | null | undefined): string {
  return formatInteger(value)
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

  const sign = numberValue > 0 ? '+' : '-';
  return `${sign}${formatNumber(Math.abs(numberValue), decimals)}%`;
}

type OptionalValueFormatOptions = {
  zeroIsMissing?: boolean
}

export function formatCurrencyARS(
  value: number | null | undefined,
  options: OptionalValueFormatOptions = {}
): string {
  const numberValue = toFiniteNumber(value)

  if (
    numberValue === null ||
    (options.zeroIsMissing === true && numberValue === 0)
  ) {
    return '—'
  }

  return `$ ${formatNumber(numberValue)}`
}

export function formatPercentage(
  value: number | null | undefined,
  options: OptionalValueFormatOptions = {}
): string {
  const numberValue = toFiniteNumber(value)

  if (
    numberValue === null ||
    (options.zeroIsMissing === true && numberValue === 0)
  ) {
    return '—'
  }

  const sign = numberValue > 0 ? '+' : numberValue < 0 ? '-' : ''

  return `${sign}${formatNumber(Math.abs(numberValue))}%`
}

export function formatDateTimeAR(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function formatDateTick(value: string | number | Date): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value * 1000)
        : new Date(`${value.slice(0, 10)}T00:00:00.000Z`)

  if (!Number.isFinite(date.getTime())) {
    return '—'
  }

  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}`
}

export function normalizeCurrency(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '—'
  }

  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()

  if (normalized === 'pesoargentino' || normalized === 'ars') {
    return 'ARS'
  }

  if (normalized === 'dolarestadounidense' || normalized === 'usd') {
    return 'USD'
  }

  return value.trim()
}
