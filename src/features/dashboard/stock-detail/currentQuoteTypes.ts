import { type StockQuoteDepthLevel } from '@/lib/stockQuote'

export type ResolvedCurrentQuote = {
  price: number | null
  variation: number | null
  open: number | null
  previousClose: number | null
  low: number | null
  high: number | null
  volume: number | null
  amountTraded: number | null
  operationCount: number | null
  buyQuantity: number | null
  buyPrice: number | null
  sellPrice: number | null
  sellQuantity: number | null
  description: string
  timestamp: string | null
  currency: string | null
  settlement: string | null
  minimumSheet: number | null
  lot: number | null
  minimumQuantity: number | null
  depth: StockQuoteDepthLevel[]
  source: 'detail' | 'snapshot' | 'history' | 'unavailable'
}
