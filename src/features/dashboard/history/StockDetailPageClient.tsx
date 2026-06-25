'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  MARKET_DATA_PANEL_KEYS,
  buildMarketPanelApiPath,
  type MarketDataPanelKey,
} from '@/lib/market'
import {
  formatCurrencyARS,
  formatDateTimeAR,
  formatPercentage,
} from '@/lib/formatters'
import { mapPanelTituloToStockProps } from '@/features/dashboard/stocks/panelTitleToStock'
import {
  fetchMarketPanel,
  type MarketPanelSuccessResponse,
} from '@/features/dashboard/panel/marketPanelClient'
import { getMarketPanelOption } from '@/features/dashboard/panel/marketPanelOptions'
import { type StockData } from '@/features/dashboard/shared/stockData'
import StockDetailsContent from '@/features/dashboard/history/StockDetailsContent'
import StockFavoriteButton from '@/features/dashboard/favorites/StockFavoriteButton'
import {
  getVariationClass,
  getVariationSeverityClass,
} from '@/features/dashboard/stocks/stockVariationSeverity'
import { useFavoriteStocks } from '@/features/dashboard/favorites/useFavoriteStocks'
import {
  DEFAULT_STOCK_HISTORY_RANGE,
  type StockHistoryRange,
} from '@/lib/stockHistory'
import { useStockHistory } from '@/features/dashboard/history/useStockHistory'
import { resolveCurrentStockQuote } from '@/features/dashboard/history/currentStockQuote'
import { useStockQuote } from '@/features/dashboard/history/useStockQuote'
import { type StockQuoteDetail } from '@/lib/stockQuote'

type StockDetailPageClientProps = {
  symbol: string
}

type PanelLookupResult = {
  stock: StockData
  panelKey: MarketDataPanelKey
  fetchedAt?: string
  servedAt?: string
}

function normalizeSymbol(value: string): string {
  try {
    return decodeURIComponent(value).trim().toUpperCase()
  } catch {
    return ''
  }
}

function usePanelData(panelKey: MarketDataPanelKey) {
  return useSWR<MarketPanelSuccessResponse, Error>(
    buildMarketPanelApiPath(panelKey),
    fetchMarketPanel,
    {
      revalidateOnFocus: false,
      errorRetryCount: 1,
    }
  )
}

function findStockInPanels(
  symbol: string,
  panels: Array<{
    key: MarketDataPanelKey
    data?: MarketPanelSuccessResponse
  }>
): PanelLookupResult | null {
  for (const panel of panels) {
    const item = panel.data?.data.find(
      (row) => row.simbolo.trim().toUpperCase() === symbol
    )

    if (item) {
      const snapshotTimestamp = panel.data?.fetchedAt ?? panel.data?.servedAt

      return {
        stock: mapPanelTituloToStockProps(item, snapshotTimestamp),
        panelKey: panel.key,
        fetchedAt: panel.data?.fetchedAt,
        servedAt: panel.data?.servedAt,
      }
    }
  }

  return null
}

function StockDetailPageResolved({
  lookup,
  quoteDetail,
  quoteSource,
  symbol,
  lookupError,
}: {
  lookup: PanelLookupResult | null
  quoteDetail: StockQuoteDetail | null
  quoteSource: 'demo' | 'live' | null
  symbol: string
  lookupError?: Error
}) {
  const { isFavorite, toggleFavoriteStock } = useFavoriteStocks()
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>(
    DEFAULT_STOCK_HISTORY_RANGE
  )
  const stock = useMemo<StockData>(
    () =>
      lookup?.stock ?? {
        ticker: quoteDetail?.symbol ?? symbol,
        description: quoteDetail?.description ?? symbol,
        price: null,
        var: null,
        varType: 'neutral',
        buyQty: null,
        buyPrice: null,
        sellPrice: null,
        sellQty: null,
        open: null,
        min: null,
        max: null,
        close: null,
        volume: null,
      },
    [lookup, quoteDetail, symbol]
  )
  const panelKey = lookup?.panelKey
  const fetchedAt = lookup?.fetchedAt
  const servedAt = lookup?.servedAt
  const history = useStockHistory(stock.ticker, historyRange)
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
    currentQuote.timestamp ?? fetchedAt ?? servedAt
  )
  const panelLabel = panelKey ? getMarketPanelOption(panelKey).label : null
  const stockIsFavorite = isFavorite(stock.ticker)
  const description = currentQuote.description
  const currentPrice = currentQuote.price

  if (currentQuote.source === 'unavailable') {
    const error = history.error ?? lookupError

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
        <Link
          href="/"
          className="ui-button ui-button-ghost stock-detail-back-link"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M5 12l14 0" />
            <path d="M5 12l6 6" />
            <path d="M5 12l6 -6" />
          </svg>
          Volver al dashboard
        </Link>

        <header className="stock-detail-page-header">
          <div className="stock-detail-page-heading">
            <div className="stock-detail-ticker-row">
              <h1>{stock.ticker}</h1>
              <StockFavoriteButton
                ticker={stock.ticker}
                isFavorite={stockIsFavorite}
                className="stock-detail-favorite-button"
                onToggleFavorite={() =>
                  toggleFavoriteStock(
                    stock,
                    panelKey ? { sourcePanel: panelKey } : undefined
                  )
                }
              />
            </div>

            <div className="stock-detail-title-row">
              <h2>{description}</h2>
              {panelLabel && (
                <span className="ui-pill ui-pill-muted stock-details-panel-label">
                  {panelLabel}
                </span>
              )}
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
}: StockDetailPageClientProps) {
  const normalizedSymbol = normalizeSymbol(symbol)
  const currentQuote = useStockQuote(normalizedSymbol)
  const liderPanel = usePanelData('lider')
  const generalPanel = usePanelData('general')
  const cedearsPanel = usePanelData('cedears')
  const panels = [
    { key: MARKET_DATA_PANEL_KEYS[0], ...liderPanel },
    { key: MARKET_DATA_PANEL_KEYS[1], ...generalPanel },
    { key: MARKET_DATA_PANEL_KEYS[2], ...cedearsPanel },
  ]
  const lookup = findStockInPanels(normalizedSymbol, panels)
  const isLoading =
    currentQuote.isLoading &&
    panels.some((panel) => panel.isLoading) &&
    !lookup
  const errors = panels
    .map((panel) => panel.error)
    .filter((error): error is Error => error instanceof Error)

  if (!normalizedSymbol) {
    return (
      <main className="stock-detail-page">
        <div className="stock-detail-shell stock-detail-state">
          <Link
            href="/"
            className="ui-button ui-button-ghost stock-detail-back-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  if (isLoading) {
    return (
      <main className="stock-detail-page">
        <div className="stock-detail-shell stock-detail-state" role="status">
          <Link
            href="/"
            className="ui-button ui-button-ghost stock-detail-back-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M5 12l14 0" />
              <path d="M5 12l6 6" />
              <path d="M5 12l6 -6" />
            </svg>
            Volver al dashboard
          </Link>
          <h1>{normalizedSymbol}</h1>
          <p>Cargando detalle del activo...</p>
        </div>
      </main>
    )
  }

  return (
    <StockDetailPageResolved
      lookup={lookup}
      quoteDetail={currentQuote.quote}
      quoteSource={currentQuote.source}
      symbol={normalizedSymbol}
      lookupError={
        errors.length === panels.length ? errors[0] : undefined
      }
    />
  )
}
