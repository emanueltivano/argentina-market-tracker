import { type StockData } from '../lib/stockData';

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
