'use client'

import Link from 'next/link'
import useSWR from 'swr'
import {
  MARKET_DATA_PANEL_KEYS,
  buildMarketPanelApiPath,
  type MarketDataPanelKey,
} from '@/lib/market'
import { formatMoney, formatSignedPercent } from '@/lib/formatters'
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

function formatTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
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
      return {
        stock: mapPanelTituloToStockProps(item),
        panelKey: panel.key,
        fetchedAt: panel.data?.fetchedAt,
        servedAt: panel.data?.servedAt,
      }
    }
  }

  return null
}

export default function StockDetailPageClient({
  symbol,
}: StockDetailPageClientProps) {
  const { isFavorite, toggleFavoriteStock } = useFavoriteStocks()
  const normalizedSymbol = normalizeSymbol(symbol)
  const liderPanel = usePanelData('lider')
  const generalPanel = usePanelData('general')
  const cedearsPanel = usePanelData('cedears')
  const panels = [
    { key: MARKET_DATA_PANEL_KEYS[0], ...liderPanel },
    { key: MARKET_DATA_PANEL_KEYS[1], ...generalPanel },
    { key: MARKET_DATA_PANEL_KEYS[2], ...cedearsPanel },
  ]
  const lookup = findStockInPanels(normalizedSymbol, panels)
  const hasAnyData = panels.some((panel) => panel.data !== undefined)
  const isLoading = panels.some((panel) => panel.isLoading) && !lookup
  const errors = panels
    .map((panel) => panel.error)
    .filter((error): error is Error => error instanceof Error)
  const isError = errors.length === panels.length && !lookup
  const isEmpty = !isLoading && !isError && hasAnyData && !lookup

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

  if (isError) {
    return (
      <main className="stock-detail-page">
        <div className="stock-detail-shell stock-detail-state" role="alert">
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
          <h1>No se pudo cargar {normalizedSymbol}</h1>
          <p>
            {errors[0]?.message ??
              'No se pudo cargar el panel de mercado para resolver el activo.'}
          </p>
        </div>
      </main>
    )
  }

  if (isEmpty || !lookup) {
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
          <h1>{normalizedSymbol}</h1>
          <p>No encontramos datos disponibles para este activo.</p>
        </div>
      </main>
    )
  }

  const { stock, panelKey, fetchedAt, servedAt } = lookup
  const varClass = getVariationClass(stock.varType)
  const severityClass = getVariationSeverityClass(stock.var, stock.varType)
  const updatedAt = formatTimestamp(fetchedAt ?? servedAt)
  const panelLabel = getMarketPanelOption(panelKey).label
  const stockIsFavorite = isFavorite(stock.ticker)

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
                  toggleFavoriteStock(stock, { sourcePanel: panelKey })
                }
              />
            </div>

            <div className="stock-detail-title-row">
              <h2>{stock.description}</h2>
              <span className="ui-pill ui-pill-muted stock-details-panel-label">
                {panelLabel}
              </span>
            </div>

            {updatedAt && (
              <p className="stock-detail-updated-at">
                <span>Actualizado: </span>
                <strong>{updatedAt}</strong>
              </p>
            )}
          </div>

          <div className="stock-detail-page-summary" aria-label="Resumen">
            <div className="stock-detail-summary-values">
              <strong className="stock-detail-price">
                {formatMoney(stock.price)}
              </strong>
              <strong
                className={`stock-var stock-detail-change ${varClass} ${severityClass}`}
              >
                {formatSignedPercent(stock.var)}
              </strong>
            </div>
          </div>
        </header>

        <StockDetailsContent stock={stock} variant="page" />
      </div>
    </main>
  )
}
