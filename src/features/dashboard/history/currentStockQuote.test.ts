import { describe, expect, it } from 'vitest'
import { type StockData } from '@/features/dashboard/shared/stockData'
import {
  appendCurrentQuoteToHistoricalSeries,
  resolveCurrentStockQuote,
} from './currentStockQuote'
import { type StockQuoteDetail } from '@/lib/stockQuote'

const snapshot: StockData = {
  ticker: 'ALUA',
  description: 'Aluar',
  price: 1028,
  var: -0.48,
  varType: 'negative',
  buyQty: 10,
  buyPrice: 1027,
  sellPrice: 1029,
  sellQty: 20,
  open: 1015,
  min: 1008,
  max: 1032,
  close: 1032.95,
  volume: 5000,
  quoteDate: '2026-06-24T20:00:00.000Z',
}

const detail: StockQuoteDetail = {
  symbol: 'GGAL',
  market: 'bcba',
  description: 'Grupo Financiero Galicia S.A',
  price: 7615,
  variation: -4.33,
  open: 7860,
  high: 7950,
  low: 7575,
  timestamp: '2026-06-24T16:59:55.3901383-03:00',
  previousClose: 7960,
  amountTraded: 20190703365,
  volume: 0,
  averagePrice: 0,
  currency: 'peso_Argentino',
  openInterest: 0,
  operationCount: 8864,
  settlement: 't1',
  minimumSheet: 1,
  lot: 1,
  minimumQuantity: 1,
  depth: [
    {
      buyQuantity: 1,
      buyPrice: 7500,
      sellPrice: 8050,
      sellQuantity: 85,
    },
  ],
}

describe('resolveCurrentStockQuote', () => {
  it('prioritizes CotizacionDetalle over the panel snapshot', () => {
    const currentQuote = resolveCurrentStockQuote(snapshot, [], detail)

    expect(currentQuote).toMatchObject({
      price: 7615,
      variation: -4.33,
      previousClose: 7960,
      amountTraded: 20190703365,
      operationCount: 8864,
      description: 'Grupo Financiero Galicia S.A',
      source: 'detail',
    })
    expect(currentQuote.depth).toEqual(detail.depth)
  })

  it('calculates previous close only when CotizacionDetalle omits a valid value', () => {
    expect(
      resolveCurrentStockQuote(snapshot, [], {
        ...detail,
        previousClose: 0,
      }).previousClose
    ).toBeCloseTo(7959.65, 1)
  })

  it('prioritizes the current snapshot when historical data differs', () => {
    const currentQuote = resolveCurrentStockQuote(
      { ...snapshot, amountTraded: 772426764.5 },
      [
      { date: '2026-06-23', close: 1008 },
      {
        date: '2026-06-24',
        close: 1037,
        amountTraded: 999,
        dailyVariation: 2.88,
        open: 1020,
        high: 1040,
        low: 1010,
      },
      ]
    )

    expect(currentQuote).toMatchObject({
      price: 1028,
      variation: -0.48,
      open: 1015,
      previousClose: 1032.95,
      low: 1008,
      high: 1032,
      volume: 5000,
      amountTraded: 772426764.5,
      source: 'snapshot',
    })
  })

  it('falls back to the latest historical amount when the snapshot omits it', () => {
    expect(
      resolveCurrentStockQuote(snapshot, [
        { date: '2026-06-23', close: 1008, amountTraded: 123 },
        { date: '2026-06-24', close: 1037, amountTraded: 772426764.5 },
      ]).amountTraded
    ).toBe(772426764.5)
  })

  it('keeps a snapshot amount of zero instead of using history', () => {
    expect(
      resolveCurrentStockQuote(
        { ...snapshot, amountTraded: 0 },
        [{ date: '2026-06-24', close: 1037, amountTraded: 999 }]
      ).amountTraded
    ).toBe(0)
  })

  it('keeps amount traded unavailable when neither source provides it', () => {
    expect(
      resolveCurrentStockQuote(snapshot, [
        { date: '2026-06-24', close: 1037 },
      ]).amountTraded
    ).toBeNull()
  })

  it('calculates previous close when the snapshot close repeats current price', () => {
    expect(
      resolveCurrentStockQuote(
        {
          ...snapshot,
          price: 7615,
          var: -4.33,
          close: 7615,
        },
        [{ date: '2026-06-23', close: 7900 }]
      ).previousClose
    ).toBeCloseTo(7959.65, 1)
  })

  it('keeps matching current and previous prices for zero variation', () => {
    expect(
      resolveCurrentStockQuote(
        {
          ...snapshot,
          price: 7615,
          var: 0,
          close: 7615,
        },
        [{ date: '2026-06-23', close: 7900 }]
      ).previousClose
    ).toBe(7615)
  })

  it('falls back to the latest valid historical point without a snapshot', () => {
    const currentQuote = resolveCurrentStockQuote(
      { ...snapshot, price: null, var: null },
      [
        { date: '2026-06-22', close: 1000 },
        { date: '2026-06-24', close: 0 },
        { date: '2026-06-23', close: 1020, dailyVariation: 2 },
      ]
    )

    expect(currentQuote).toMatchObject({
      price: 1020,
      variation: 2,
      previousClose: 1000,
      source: 'history',
    })
  })

  it('appends an intraday candle when the snapshot is newer than history', () => {
    const currentQuote = resolveCurrentStockQuote(snapshot, [
      { date: '2026-06-23', close: 1037 },
    ])

    expect(
      appendCurrentQuoteToHistoricalSeries(
        [{ date: '2026-06-23', close: 1037 }],
        currentQuote
      )
    ).toEqual([
      { date: '2026-06-23', close: 1037 },
      {
        date: '2026-06-24',
        timestamp: '2026-06-24T20:00:00.000Z',
        open: 1015,
        high: 1032,
        low: 1008,
        close: 1028,
        volume: 5000,
      },
    ])
  })

  it('appends an intraday candle from CotizacionDetalle', () => {
    const currentQuote = resolveCurrentStockQuote(snapshot, [], detail)

    expect(
      appendCurrentQuoteToHistoricalSeries(
        [{ date: '2026-06-23', close: 7960 }],
        currentQuote
      ).at(-1)
    ).toMatchObject({
      date: '2026-06-24',
      open: 7860,
      high: 7950,
      low: 7575,
      close: 7615,
      volume: 0,
    })
  })

  it('does not duplicate today and repairs missing intraday OHLC values', () => {
    const currentQuote = resolveCurrentStockQuote(
      { ...snapshot, open: 0, min: 0, max: 0 },
      [{ date: '2026-06-23', close: 1037 }]
    )

    expect(
      appendCurrentQuoteToHistoricalSeries(
        [{ date: '2026-06-24', close: 1037 }],
        currentQuote
      )
    ).toEqual([{ date: '2026-06-24', close: 1037 }])

    expect(
      appendCurrentQuoteToHistoricalSeries(
        [{ date: '2026-06-23', close: 1037 }],
        currentQuote
      ).at(-1)
    ).toMatchObject({
      date: '2026-06-24',
      open: 1028,
      high: 1028,
      low: 1028,
      close: 1028,
    })
  })

  it('does not append a historical fallback as a new intraday candle', () => {
    const currentQuote = resolveCurrentStockQuote(
      { ...snapshot, price: null },
      [{ date: '2026-06-23', close: 1037 }]
    )

    expect(
      appendCurrentQuoteToHistoricalSeries(
        [{ date: '2026-06-23', close: 1037 }],
        currentQuote
      )
    ).toEqual([{ date: '2026-06-23', close: 1037 }])
  })
})
