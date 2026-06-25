import { type StockData } from '@/features/dashboard/shared/stockData'
import {
  calculateDailyQuoteMetrics,
  getLatestHistoryQuotes,
  toMarketDateString,
} from '@/features/dashboard/charts/advancedStockChart'
import { type StockHistoryPoint } from '@/lib/stockHistory'
import { resolvePreviousClose } from '@/features/dashboard/shared/stockQuoteMetrics'
import {
  type StockQuoteDepthLevel,
  type StockQuoteDetail,
} from '@/lib/stockQuote'

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

export type ArgentinaMarketStatus = {
  isOpen: boolean
  sessionDate: string | null
}

export type LiveSessionCandle = StockHistoryPoint & {
  timestamp: string
}

type MergeLiveQuoteOptions = {
  now: Date
  quoteSource: 'demo' | 'live' | null
  previousLiveCandle?: LiveSessionCandle | null
}

type MergeLiveQuoteResult = {
  points: StockHistoryPoint[]
  liveSessionCandle: LiveSessionCandle | null
}

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const MARKET_OPEN_MINUTE = 11 * 60
const MARKET_CLOSE_MINUTE = 17 * 60

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positivePrice(value: number | null | undefined): number | null {
  const numberValue = finiteNumber(value)

  return numberValue !== null && numberValue > 0 ? numberValue : null
}

function getArgentinaDateTimeParts(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    return null
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)

  return weekday && Number.isFinite(hour) && Number.isFinite(minute)
    ? { weekday, minuteOfDay: hour * 60 + minute }
    : null
}

export function getArgentinaMarketStatus(
  now: Date
): ArgentinaMarketStatus {
  const sessionDate = toMarketDateString(now, ARGENTINA_TIME_ZONE)
  const parts = getArgentinaDateTimeParts(now)
  const isWeekday =
    parts !== null && !['Sat', 'Sun'].includes(parts.weekday)
  const isWithinRegularSession =
    parts !== null &&
    parts.minuteOfDay >= MARKET_OPEN_MINUTE &&
    parts.minuteOfDay < MARKET_CLOSE_MINUTE

  return {
    isOpen: Boolean(sessionDate && isWeekday && isWithinRegularSession),
    sessionDate,
  }
}

export function shouldUseLiveCandle(
  quote: ResolvedCurrentQuote,
  marketStatus: ArgentinaMarketStatus,
  quoteSource: 'demo' | 'live' | null
): boolean {
  if (
    quoteSource !== 'live' ||
    quote.source !== 'detail' ||
    !marketStatus.isOpen ||
    !marketStatus.sessionDate ||
    quote.price === null ||
    quote.price <= 0 ||
    !quote.timestamp
  ) {
    return false
  }

  const operationTime = new Date(quote.timestamp)
  const operationDate = toMarketDateString(
    operationTime,
    ARGENTINA_TIME_ZONE
  )
  const operationParts = getArgentinaDateTimeParts(operationTime)

  return (
    operationDate === marketStatus.sessionDate &&
    operationParts !== null &&
    operationParts.minuteOfDay >= MARKET_OPEN_MINUTE &&
    operationParts.minuteOfDay < MARKET_CLOSE_MINUTE
  )
}

export function mergeLiveQuoteIntoHistoricalSeries(
  historicalSeries: readonly StockHistoryPoint[],
  currentQuote: ResolvedCurrentQuote,
  options: MergeLiveQuoteOptions
): MergeLiveQuoteResult {
  const historicalPoints = historicalSeries.map((point) => ({ ...point }))
  const marketStatus = getArgentinaMarketStatus(options.now)

  if (
    !shouldUseLiveCandle(
      currentQuote,
      marketStatus,
      options.quoteSource
    ) ||
    !marketStatus.sessionDate ||
    !currentQuote.timestamp ||
    currentQuote.price === null
  ) {
    return {
      points: historicalPoints,
      liveSessionCandle: null,
    }
  }

  const sessionDate = marketStatus.sessionDate
  const existingIndex = historicalPoints.findIndex(
    (point) => point.date === sessionDate
  )
  const existingPoint =
    existingIndex >= 0 ? historicalPoints[existingIndex] : undefined
  const previousLiveCandle =
    options.previousLiveCandle?.date === sessionDate
      ? options.previousLiveCandle
      : null
  const open =
    positivePrice(existingPoint?.open) ??
    positivePrice(currentQuote.open) ??
    positivePrice(previousLiveCandle?.open) ??
    currentQuote.price
  const existingHigh =
    positivePrice(existingPoint?.high) ??
    positivePrice(previousLiveCandle?.high) ??
    positivePrice(currentQuote.high) ??
    open
  const existingLow =
    positivePrice(existingPoint?.low) ??
    positivePrice(previousLiveCandle?.low) ??
    positivePrice(currentQuote.low) ??
    open
  const liveSessionCandle: LiveSessionCandle = {
    ...existingPoint,
    date: sessionDate,
    timestamp: currentQuote.timestamp,
    open,
    high: Math.max(existingHigh, currentQuote.price),
    low: Math.min(existingLow, currentQuote.price),
    close: currentQuote.price,
    ...(currentQuote.volume !== null
      ? { volume: currentQuote.volume }
      : {}),
  }

  if (existingIndex >= 0) {
    historicalPoints[existingIndex] = liveSessionCandle
  } else {
    historicalPoints.push(liveSessionCandle)
  }

  return {
    points: historicalPoints.sort((first, second) =>
      first.date.localeCompare(second.date)
    ),
    liveSessionCandle,
  }
}

export function resolveCurrentStockQuote(
  stock: StockData,
  historicalSeries: readonly StockHistoryPoint[],
  quoteDetail: StockQuoteDetail | null = null
): ResolvedCurrentQuote {
  const { latestHistoricalPoint, previousHistoricalPoint } =
    getLatestHistoryQuotes(historicalSeries)
  const historicalDailyMetrics = calculateDailyQuoteMetrics(
    latestHistoricalPoint,
    previousHistoricalPoint
  )
  const snapshotPrice = positivePrice(stock.price)

  if (quoteDetail) {
    const previousClose = resolvePreviousClose({
      currentPrice: quoteDetail.price,
      variation: quoteDetail.variation,
      explicitPreviousClose: quoteDetail.previousClose,
      historicalPreviousClose: historicalDailyMetrics.previousClose,
    })

    return {
      price: quoteDetail.price,
      variation:
        quoteDetail.variation ??
        (previousClose !== null
          ? ((quoteDetail.price - previousClose) / previousClose) * 100
          : null),
      open: positivePrice(quoteDetail.open),
      previousClose,
      low: positivePrice(quoteDetail.low),
      high: positivePrice(quoteDetail.high),
      volume: finiteNumber(quoteDetail.volume),
      amountTraded: finiteNumber(quoteDetail.amountTraded),
      operationCount: finiteNumber(quoteDetail.operationCount),
      buyQuantity: finiteNumber(quoteDetail.depth[0]?.buyQuantity),
      buyPrice: positivePrice(quoteDetail.depth[0]?.buyPrice),
      sellPrice: positivePrice(quoteDetail.depth[0]?.sellPrice),
      sellQuantity: finiteNumber(quoteDetail.depth[0]?.sellQuantity),
      description: quoteDetail.description || stock.description,
      timestamp: quoteDetail.timestamp,
      currency: quoteDetail.currency,
      settlement: quoteDetail.settlement,
      minimumSheet: finiteNumber(quoteDetail.minimumSheet),
      lot: finiteNumber(quoteDetail.lot),
      minimumQuantity: finiteNumber(quoteDetail.minimumQuantity),
      depth: quoteDetail.depth,
      source: 'detail',
    }
  }

  if (snapshotPrice === null) {
    if (!latestHistoricalPoint) {
      return {
        price: null,
        variation: null,
        open: null,
        previousClose: null,
        low: null,
        high: null,
        volume: null,
        amountTraded: null,
        operationCount: null,
        buyQuantity: null,
        buyPrice: null,
        sellPrice: null,
        sellQuantity: null,
        description: stock.description,
        timestamp: stock.quoteDate ?? null,
        currency: stock.currency ?? null,
        settlement: stock.settlement ?? null,
        minimumSheet: finiteNumber(stock.minimumSheet),
        lot: finiteNumber(stock.lot),
        minimumQuantity: null,
        depth: [],
        source: 'unavailable',
      }
    }

    return {
      price: latestHistoricalPoint.close,
      variation: historicalDailyMetrics.dailyVariation,
      open: positivePrice(latestHistoricalPoint.open),
      previousClose: historicalDailyMetrics.previousClose,
      low: positivePrice(latestHistoricalPoint.low),
      high: positivePrice(latestHistoricalPoint.high),
      volume: finiteNumber(latestHistoricalPoint.volume),
      amountTraded: finiteNumber(latestHistoricalPoint.amountTraded),
      operationCount: finiteNumber(latestHistoricalPoint.operationCount),
      buyQuantity: finiteNumber(latestHistoricalPoint.bid?.buyQuantity),
      buyPrice: positivePrice(latestHistoricalPoint.bid?.buyPrice),
      sellPrice: positivePrice(latestHistoricalPoint.bid?.sellPrice),
      sellQuantity: finiteNumber(latestHistoricalPoint.bid?.sellQuantity),
      description: latestHistoricalPoint.description ?? stock.description,
      timestamp: latestHistoricalPoint.timestamp ?? null,
      currency: latestHistoricalPoint.currency ?? null,
      settlement: latestHistoricalPoint.settlement ?? null,
      minimumSheet: finiteNumber(latestHistoricalPoint.minimumSheet),
      lot: finiteNumber(latestHistoricalPoint.lot),
      minimumQuantity: null,
      depth: latestHistoricalPoint.bid
        ? [
            {
              buyQuantity: finiteNumber(
                latestHistoricalPoint.bid.buyQuantity
              ),
              buyPrice: finiteNumber(latestHistoricalPoint.bid.buyPrice),
              sellPrice: finiteNumber(latestHistoricalPoint.bid.sellPrice),
              sellQuantity: finiteNumber(
                latestHistoricalPoint.bid.sellQuantity
              ),
            },
          ]
        : [],
      source: 'history',
    }
  }

  const snapshotPreviousClose = resolvePreviousClose({
    currentPrice: snapshotPrice,
    variation: stock.var,
    explicitPreviousClose: stock.close,
    historicalPreviousClose: historicalDailyMetrics.previousClose,
  })
  const snapshotVariation = finiteNumber(stock.var)

  return {
    price: snapshotPrice,
    variation:
      snapshotVariation ??
      (snapshotPreviousClose !== null
        ? ((snapshotPrice - snapshotPreviousClose) / snapshotPreviousClose) *
          100
        : null),
    open: positivePrice(stock.open),
    previousClose: snapshotPreviousClose,
    low: positivePrice(stock.min),
    high: positivePrice(stock.max),
    volume: finiteNumber(stock.volume),
    amountTraded:
      finiteNumber(stock.amountTraded) ??
      finiteNumber(latestHistoricalPoint?.amountTraded),
    operationCount: finiteNumber(stock.operationCount),
    buyQuantity: finiteNumber(stock.buyQty),
    buyPrice: positivePrice(stock.buyPrice),
    sellPrice: positivePrice(stock.sellPrice),
    sellQuantity: finiteNumber(stock.sellQty),
    description: stock.description,
    timestamp: stock.quoteDate ?? null,
    currency: stock.currency ?? null,
    settlement: stock.settlement ?? null,
    minimumSheet: finiteNumber(stock.minimumSheet),
    lot: finiteNumber(stock.lot),
    minimumQuantity: null,
    depth:
      stock.buyQty !== null ||
      stock.buyPrice !== null ||
      stock.sellPrice !== null ||
      stock.sellQty !== null
        ? [
            {
              buyQuantity: finiteNumber(stock.buyQty),
              buyPrice: finiteNumber(stock.buyPrice),
              sellPrice: finiteNumber(stock.sellPrice),
              sellQuantity: finiteNumber(stock.sellQty),
            },
          ]
        : [],
    source: 'snapshot',
  }
}
