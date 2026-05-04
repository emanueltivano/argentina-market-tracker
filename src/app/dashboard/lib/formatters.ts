export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  locale = 'es-AR',
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function formatMoney(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return `$ ${formatNumber(value)}`;
}

export function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0);
}

export function formatSignedPercent(
  value: number | null | undefined,
  decimals = 2,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  const n = Number(value);

  if (n === 0) {
    return `${formatNumber(0, decimals)}%`;
  }

  const sign = n > 0 ? '+ ' : '- ';
  return `${sign}${formatNumber(Math.abs(n), decimals)}%`;
}
