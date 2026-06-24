export interface StockData {
  ticker: string;
  description: string;
  price: number | null;
  var: number | null;
  varType: 'positive' | 'negative' | 'neutral';
  buyQty: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  sellQty: number | null;
  open: number | null;
  min: number | null;
  max: number | null;
  close: number | null;
  volume: number | null;
  quoteDate?: string | null;
  amountTraded?: number | null;
  operationCount?: number | null;
  currency?: string | null;
  settlement?: string | null;
  minimumSheet?: number | null;
  lot?: number | null;
}
