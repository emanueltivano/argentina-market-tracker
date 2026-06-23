import { type StockData } from '../lib/stockData';

export function getVariationSeverityClass(
  value: number | null,
  type: StockData['varType'],
): string {
  if (value === null || type === 'neutral') {
    return '';
  }

  const absoluteValue = Math.abs(value);

  if (type === 'positive') {
    return absoluteValue >= 3 ? 'stock-var-strong' : 'stock-var-soft';
  }

  if (absoluteValue >= 5) {
    return 'stock-var-strong';
  }

  if (absoluteValue >= 3) {
    return 'stock-var-medium';
  }

  return 'stock-var-soft';
}
