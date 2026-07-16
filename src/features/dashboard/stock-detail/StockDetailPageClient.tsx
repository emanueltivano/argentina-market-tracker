'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  formatCurrencyARS,
  formatDateTimeAR,
  formatPercentage,
} from '@/lib/formatters'
import { type StockData } from '@/features/dashboard/shared/stockData'
import StockDetailsContent from '@/features/dashboard/stock-detail/StockDetailsContent'
import StockFavoriteButton from '@/features/dashboard/favorites/StockFavoriteButton'
import {
  getVariationClass,
  getVariationSeverityClass,
} from '@/features/dashboard/stocks/stockVariationSeverity'
import { useFavoriteStocks } from '@/features/dashboard/favorites/useFavoriteStocks'
import {
  DEFAULT_STOCK_HISTORY_MARKET,
  DEFAULT_STOCK_HISTORY_RANGE,
  type StockHistoryRange,
} from '@/lib/stockHistory'
import { useStockHistory } from '@/features/dashboard/stock-detail/useStockHistory'
import { resolveCurrentStockQuote } from '@/features/dashboard/stock-detail/currentStockQuote'
import { useStockQuote } from '@/features/dashboard/stock-detail/useStockQuote'
import type {
  StockQuoteDetail,
  StockQuoteInitialLoadState,
  StockQuoteSuccessResponse,
} from '@/lib/stockQuote'
import { parseStockSymbolParam } from '@/lib/stockSymbol'

type StockDetailPageClientProps = {
  symbol: string
  initialQuote?: StockQuoteSuccessResponse
  initialQuoteState?: StockQuoteInitialLoadState
}

function StockQuoteRateLimitNotice({
  initialState,
  isRetrying,
  onRetry,
}: {
  initialState: StockQuoteInitialLoadState
  isRetrying: boolean
  onRetry: () => void
}) {
  if (
    initialState.status !== 'rate-limited' &&
    initialState.status !== 'rate-limit-unavailable'
  ) {
    return null
  }

  return (
    <div className="stock-detail-quote-notice" role="alert">
      <p>
        {initialState.status === 'rate-limited'
          ? 'Se alcanzó temporalmente el límite de cotizaciones.'
          : 'El control de solicitudes no está disponible temporalmente.'}{' '}
        Podés volver a intentar en {initialState.retryAfterSec} segundos.
      </p>
      <button
        type="button"
        className="ui-button"
        disabled={isRetrying}
        onClick={onRetry}
      >
        {isRetrying ? 'Reintentando cotización…' : 'Reintentar cotización'}
      </button>
    </div>
  )
}

function StockQuoteStaleNotice({
  fetchedAt,
  stale,
}: {
  fetchedAt?: string
  stale: boolean
}) {
  if (!stale) {
    return null
  }

  const updatedAt = formatDateTimeAR(fetchedAt)

  return (
    <div className="stock-detail-quote-notice" role="status" aria-live="polite">
      <p>
        Los datos de la cotización pueden estar desactualizados.
        {updatedAt !== '—' ? ` Última actualización: ${updatedAt}.` : ''}
      </p>
    </div>
  )
}

function getVariationType(
  variation: number | null
): StockData['varType'] {
  if (variation === null || variation === 0) {
    return 'neutral'
  }

  return variation > 0 ? 'positive' : 'negative'
}

function quoteDetailToStockData(
  symbol: string,
  quoteDetail: StockQuoteDetail | null
): StockData {
  const depth = quoteDetail?.depth[0]
  const variation = quoteDetail?.variation ?? null

  return {
    ticker: quoteDetail?.symbol ?? symbol,
    description: quoteDetail?.description || symbol,
    price: quoteDetail?.price ?? null,
    var: variation,
    varType: getVariationType(variation),
    buyQty: depth?.buyQuantity ?? null,
    buyPrice: depth?.buyPrice ?? null,
    sellPrice: depth?.sellPrice ?? null,
    sellQty: depth?.sellQuantity ?? null,
    open: quoteDetail?.open ?? null,
    min: quoteDetail?.low ?? null,
    max: quoteDetail?.high ?? null,
    close: quoteDetail?.previousClose ?? null,
    volume: quoteDetail?.volume ?? null,
    quoteDate: quoteDetail?.timestamp ?? null,
    amountTraded: quoteDetail?.amountTraded ?? null,
    operationCount: quoteDetail?.operationCount ?? null,
    currency: quoteDetail?.currency ?? null,
    settlement: quoteDetail?.settlement ?? null,
    minimumSheet: quoteDetail?.minimumSheet ?? null,
    lot: quoteDetail?.lot ?? null,
  }
}

function StockDetailPageResolved({
  quoteDetail,
  quoteSource,
  symbol,
  quoteInitialState,
  quoteIsRetrying,
  onQuoteRetry,
  quoteStale,
  quoteFetchedAt,
}: {
  quoteDetail: StockQuoteDetail | null
  quoteSource: 'demo' | 'live' | null
  symbol: string
  quoteInitialState: StockQuoteInitialLoadState
  quoteIsRetrying: boolean
  onQuoteRetry: () => void
  quoteStale: boolean
  quoteFetchedAt?: string
}) {
  const { isFavorite, toggleFavoriteStock } = useFavoriteStocks()
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>(
    DEFAULT_STOCK_HISTORY_RANGE
  )
  const stock = useMemo<StockData>(
    () => quoteDetailToStockData(symbol, quoteDetail),
    [quoteDetail, symbol]
  )
  const history = useStockHistory(stock.ticker, historyRange, undefined, {
    enabled: true,
  })
  const currentQuote = useMemo(
    () => resolveCurrentStockQuote(stock, history.points, quoteDetail),
    [history.points, quoteDetail, stock]
  )
  const dailyVariation = currentQuote.variation
  const variationType =
    dailyVariation === null || dailyVariation === 0
      ? 'neutral'
      : dailyVariation > 0
        ? 'positive'
        : 'negative'
  const varClass = getVariationClass(variationType)
  const severityClass = getVariationSeverityClass(
    dailyVariation,
    variationType
  )
  const updatedAt = formatDateTimeAR(
    currentQuote.timestamp ?? quoteFetchedAt
  )
  const stockIsFavorite = isFavorite(stock.ticker)
  const description = currentQuote.description
  const currentPrice = currentQuote.price

  if (currentQuote.source === 'unavailable') {
    const error = history.error

    return (
      <main className="stock-detail-page">
        <div
          className="stock-detail-shell stock-detail-state"
          {...(error ? { role: 'alert' } : {})}
        >
          <Link
            href="/"
            className="ui-button ui-button-ghost stock-detail-back-link"
          >
            Volver al dashboard
          </Link>
          <StockQuoteRateLimitNotice
            initialState={quoteInitialState}
            isRetrying={quoteIsRetrying}
            onRetry={onQuoteRetry}
          />
          <h1>{error ? `No se pudo cargar ${symbol}` : symbol}</h1>
          <p>
            {history.isLoading
              ? 'Cargando detalle del activo...'
              : error?.message ??
                'No encontramos datos disponibles para este activo.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="stock-detail-page">
      <div className="stock-detail-shell">
        <StockQuoteRateLimitNotice
          initialState={quoteInitialState}
          isRetrying={quoteIsRetrying}
          onRetry={onQuoteRetry}
        />
        <StockQuoteStaleNotice
          stale={quoteStale}
          fetchedAt={quoteFetchedAt}
        />
        <div className="stock-detail-page-topbar">
          <Link
            href="/"
            className="ui-icon-button stock-detail-icon-button stock-detail-back-link"
            aria-label="Volver al dashboard"
            title="Volver al dashboard"
          >
            <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M5 12l14 0" />
              <path d="M5 12l6 6" />
              <path d="M5 12l6 -6" />
            </svg>
          </Link>

          <h1 className="page-title">{stock.ticker}</h1>

          <div className="stock-detail-page-actions">
            <StockFavoriteButton
              ticker={stock.ticker}
              isFavorite={stockIsFavorite}
              className="stock-detail-icon-button stock-detail-favorite-button"
              onToggleFavorite={() =>
                toggleFavoriteStock(stock)
              }
            />
          </div>
        </div>
        <header className="stock-detail-page-header">
          <div className="stock-detail-page-heading">
            <div className="stock-detail-title-row">
              <h2>{description}</h2>
            </div>

            {updatedAt !== '—' && (
              <p className="stock-detail-updated-at">
                <span>Actualizado: </span>
                <strong>{updatedAt}</strong>
                <span> · hora argentina</span>
              </p>
            )}
          </div>

          <div className="stock-detail-page-summary" aria-label="Resumen">
            <div className="stock-detail-summary-values">
              <strong className="stock-detail-price">
                {formatCurrencyARS(currentPrice, { zeroIsMissing: true })}
              </strong>
              <strong
                className={`stock-var stock-detail-change ${varClass} ${severityClass}`}
                aria-label="Variación diaria"
              >
                {formatPercentage(dailyVariation)}
              </strong>
            </div>
          </div>
        </header>

        <StockDetailsContent
          stock={stock}
          variant="page"
          historyRange={historyRange}
          onHistoryRangeChange={setHistoryRange}
          history={history}
          quoteDetail={quoteDetail}
          quoteSource={quoteSource}
        />
      </div>
    </main>
  )
}

export default function StockDetailPageClient({
  symbol,
  initialQuote,
  initialQuoteState = { status: 'no-initial-data' },
}: StockDetailPageClientProps) {
  const normalizedSymbol = parseStockSymbolParam(symbol) ?? ''
  const currentQuote = useStockQuote(
    normalizedSymbol,
    DEFAULT_STOCK_HISTORY_MARKET,
    { initialData: initialQuote, initialState: initialQuoteState }
  )

  if (!normalizedSymbol) {
    return (
      <main className="stock-detail-page">
        <div className="stock-detail-shell stock-detail-state">
          <Link
            href="/"
            className="ui-button ui-button-ghost stock-detail-back-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M5 12l14 0" />
              <path d="M5 12l6 6" />
              <path d="M5 12l6 -6" />
            </svg>
            Volver al dashboard
          </Link>
          <h1>Activo inválido</h1>
          <p>La URL no incluye un símbolo válido para consultar.</p>
        </div>
      </main>
    )
  }

  return (
    <StockDetailPageResolved
      quoteDetail={currentQuote.quote}
      quoteSource={currentQuote.source}
      symbol={normalizedSymbol}
      quoteInitialState={currentQuote.initialState}
      quoteIsRetrying={currentQuote.isRetrying}
      onQuoteRetry={() => void currentQuote.retry()}
      quoteStale={currentQuote.stale}
      quoteFetchedAt={currentQuote.fetchedAt}
    />
  )
}
