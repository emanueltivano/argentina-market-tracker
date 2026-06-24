import { type StockData } from '@/features/dashboard/shared/stockData';

const VARIATION_CLASS_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'stock-var-positive',
  negative: 'stock-var-negative',
  neutral: 'stock-var-neutral',
};

export function getVariationClass(type: StockData['varType']): string {
  return VARIATION_CLASS_BY_TYPE[type];
}

export function getVariationSeverityClass(
  value: number | null,
  type: StockData['varType'],
): string {
  if (value === null || type === 'neutral') {
    return '';
  }

  const absoluteValue = Math.abs(value);
  const severity =
    absoluteValue >= 5 ? 'strong' : absoluteValue >= 3 ? 'medium' : 'soft';

  return `stock-var-${severity} stock-var-${type}-${severity}`;
}
