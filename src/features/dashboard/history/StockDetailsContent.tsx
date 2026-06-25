'use client'

import { useMemo, useState } from 'react'
import { type StockData } from '@/features/dashboard/shared/stockData'
import LightweightStockChart from '@/features/dashboard/charts/LightweightStockChart'
import AdvancedStockDetailChart from '@/features/dashboard/charts/AdvancedStockDetailChart'
import {
  formatCurrencyARS,
  formatInteger,
  formatMoney,
  formatPercentage,
  formatQuantity,
  formatSignedPercent,
  normalizeCurrency,
} from '@/lib/formatters'
import {
  DEFAULT_STOCK_HISTORY_RANGE,
  STOCK_HISTORY_RANGES,
  type StockHistoryPoint,
  type StockHistoryRange,
  type StockHistoryResponseMeta,
} from '@/lib/stockHistory'
import { useStockHistory } from '@/features/dashboard/history/useStockHistory'
import {
  calculatePeriodStats,
  normalizeHistoryPoints,
} from '@/features/dashboard/charts/advancedStockChart'
import {
  appendCurrentQuoteToHistoricalSeries,
  resolveCurrentStockQuote,
} from '@/features/dashboard/history/currentStockQuote'
import {
  getVariationClass,
  getVariationSeverityClass,
} from '@/features/dashboard/stocks/stockVariationSeverity'
import { type StockQuoteDetail } from '@/lib/stockQuote'

type HistoryViewState = {
  points: StockHistoryPoint[]
  meta?: StockHistoryResponseMeta
  error?: Error
  isLoading: boolean
  isRefreshing: boolean
  viewStatus: 'loading' | 'error' | 'empty' | 'success'
}

type StockDetailsContentProps =
  | {
      stock: StockData
      variant?: 'modal'
    }
  | {
      stock: StockData
      variant: 'page'
      historyRange: StockHistoryRange
      onHistoryRangeChange: (range: StockHistoryRange) => void
      history: HistoryViewState
      quoteDetail?: StockQuoteDetail | null
    }

type StockDetailRow = {
  label: string
  value: string
  className?: string
  valueClassName?: string
}

const HISTORY_RANGE_LABEL: Record<StockHistoryRange, string> = {
  '1W': 'Última semana',
  '1M': 'Último mes',
  '3M': 'Últimos 3 meses',
  '6M': 'Últimos 6 meses',
  '1Y': 'Último año',
}

function getHistoryVariationClass(value: number | null): string {
  if (value === null || value === 0) {
    return 'stock-history-performance-neutral'
  }

  return value > 0
    ? 'stock-history-performance-positive'
    : 'stock-history-performance-negative'
}

function HistoryRangeControls({
  range,
  onChange,
}: {
  range: StockHistoryRange
  onChange: (range: StockHistoryRange) => void
}) {
  return (
    <div className="stock-history-range-control">
      <span className="stock-history-control-label">Período</span>
      <div className="stock-history-range-group" aria-label="Período">
        {STOCK_HISTORY_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            className={
              option === range
                ? 'stock-history-range-button stock-history-range-button-active'
                : 'stock-history-range-button'
            }
            onClick={() => onChange(option)}
            aria-pressed={option === range}
            title={HISTORY_RANGE_LABEL[option]}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function HistorySection({
  stock,
  variant,
  historyRange,
  onHistoryRangeChange,
  history,
  quoteDetail,
}: {
  stock: StockData
  variant: 'modal' | 'page'
  historyRange: StockHistoryRange
  onHistoryRangeChange: (range: StockHistoryRange) => void
  history: HistoryViewState
  quoteDetail?: StockQuoteDetail | null
}) {
  const currentQuote = useMemo(
    () => resolveCurrentStockQuote(stock, history.points, quoteDetail),
    [history.points, quoteDetail, stock]
  )
  const chartSeries = useMemo(
    () => appendCurrentQuoteToHistoricalSeries(history.points, currentQuote),
    [currentQuote, history.points]
  )
  const normalizedHistoryPoints = useMemo(
    () => normalizeHistoryPoints(chartSeries),
    [chartSeries]
  )
  const periodMetrics = useMemo(
    () => calculatePeriodStats(normalizedHistoryPoints),
    [normalizedHistoryPoints]
  )
  const periodVariation = periodMetrics?.periodVariation ?? null
  const periodVariationClass = getHistoryVariationClass(periodVariation)
  const dailyVariation = currentQuote.variation
  const dailyVariationType =
    dailyVariation === null || dailyVariation === 0
      ? 'neutral'
      : dailyVariation > 0
        ? 'positive'
        : 'negative'
  const dailyVariationClass = getVariationClass(dailyVariationType)
  const dailySeverityClass = getVariationSeverityClass(
    dailyVariation,
    dailyVariationType
  )
  const historyDataStatus = history.meta
    ? history.meta.stale
      ? 'Stale'
      : history.meta.source === 'demo'
        ? 'Demo'
        : 'Live'
    : null
  const historyMetaMessage =
    history.viewStatus === 'success' && history.meta
      ? history.meta.stale
        ? 'Mostrando histórico cacheado por una falla temporal del upstream.'
        : history.meta.discardedPoints > 0
          ? `Se descartaron ${history.meta.discardedPoints} de ${history.meta.totalPoints} puntos inválidos del upstream.`
          : history.meta.source === 'demo'
            ? 'Serie histórica de demo determinística.'
            : null
      : null
  const rangeControls = (
    <HistoryRangeControls
      range={historyRange}
      onChange={onHistoryRangeChange}
    />
  )
  return (
    <>
      <section
        className="stock-history-section"
        aria-labelledby="stock-history-title"
      >
        <div className="stock-history-header">
          <div className="stock-history-heading">
            <h2 id="stock-history-title" className="stock-history-title">
              Histórico
            </h2>
            <p className="stock-history-subtitle">
              {HISTORY_RANGE_LABEL[historyRange]}:{' '}
              {history.viewStatus === 'success' && periodVariation !== null ? (
                <span
                  className={`stock-history-performance ${periodVariationClass}`}
                >
                  {formatPercentage(periodVariation)}
                </span>
              ) : (
                <span className="stock-history-performance stock-history-performance-neutral">
                  —
                </span>
              )}
            </p>
            {historyMetaMessage && (
              <p className="stock-history-subtitle stock-history-subtitle-meta">
                {historyMetaMessage}
              </p>
            )}
          </div>

          {variant === 'modal' && rangeControls}
        </div>

        {history.isLoading && (
          <div className="stock-history-state stock-history-state-loading" role="status">
            <span className="stock-history-skeleton" aria-hidden="true" />
            Cargando histórico...
          </div>
        )}

        {history.viewStatus === 'error' && (
          <div className="stock-history-state stock-history-state-error" role="alert">
            {history.error?.message ?? 'No se pudo cargar el histórico.'}
          </div>
        )}

        {history.viewStatus === 'empty' && (
          <div className="stock-history-state">
            <strong>Sin histórico disponible</strong>
            <span>No hay datos históricos para este rango.</span>
          </div>
        )}

        {history.viewStatus === 'success' && (
          <div
            className={
              history.isRefreshing
                ? 'stock-history-chart-wrap stock-history-chart-wrap-refreshing'
                : 'stock-history-chart-wrap'
            }
          >
            {variant === 'page' ? (
              <AdvancedStockDetailChart
                points={chartSeries}
                symbol={stock.ticker}
                rangeControls={rangeControls}
              />
            ) : (
              <LightweightStockChart
                points={chartSeries}
                symbol={stock.ticker}
              />
            )}
          </div>
        )}
      </section>

      {variant === 'page' && (
        <>
          <section
            className="stock-detail-data-section"
            aria-labelledby="stock-detail-period-title"
          >
            <div className="stock-detail-section-header">
              <h2 id="stock-detail-period-title">Resumen del período</h2>
            </div>
            <dl className="stock-detail-period-metrics">
              <div className="stock-detail-period-metric">
                <dt>Precio actual</dt>
                <dd>
                  {formatCurrencyARS(currentQuote.price, {
                    zeroIsMissing: true,
                  })}
                </dd>
              </div>
              <div className="stock-detail-period-metric">
                <dt>Variación del período</dt>
                <dd className={periodVariationClass}>
                  {formatPercentage(periodVariation)}
                </dd>
              </div>
              <div className="stock-detail-period-metric">
                <dt>Máximo del período</dt>
                <dd>
                  {formatCurrencyARS(periodMetrics?.periodHigh, {
                    zeroIsMissing: true,
                  })}
                </dd>
              </div>
              <div className="stock-detail-period-metric">
                <dt>Mínimo del período</dt>
                <dd>
                  {formatCurrencyARS(periodMetrics?.periodLow, {
                    zeroIsMissing: true,
                  })}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="stock-detail-data-section"
            aria-labelledby="stock-detail-daily-title"
          >
            <div className="stock-detail-section-header">
              <h2 id="stock-detail-daily-title">Cotización diaria</h2>
              {historyDataStatus && <span>{historyDataStatus}</span>}
            </div>
            <dl className="stock-detail-secondary-grid">
              <div className="stock-detail-secondary-metric">
                <dt>Apertura</dt>
                <dd>{formatCurrencyARS(currentQuote.open, { zeroIsMissing: true })}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Cierre anterior</dt>
                <dd>{formatCurrencyARS(currentQuote.previousClose, { zeroIsMissing: true })}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Mínimo diario</dt>
                <dd>{formatCurrencyARS(currentQuote.low, { zeroIsMissing: true })}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Máximo diario</dt>
                <dd>{formatCurrencyARS(currentQuote.high, { zeroIsMissing: true })}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Variación diaria</dt>
                <dd
                  className={`stock-var stock-detail-secondary-variation ${dailyVariationClass} ${dailySeverityClass}`.trim()}
                >
                  {formatPercentage(dailyVariation)}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="stock-detail-data-section"
            aria-labelledby="stock-detail-liquidity-title"
          >
            <div className="stock-detail-section-header">
              <h2 id="stock-detail-liquidity-title">Liquidez</h2>
            </div>
            <dl className="stock-detail-secondary-grid">
              <div className="stock-detail-secondary-metric">
                <dt>Volumen nominal</dt>
                <dd>{formatQuantity(currentQuote.volume)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Monto operado</dt>
                <dd>{formatCurrencyARS(currentQuote.amountTraded)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Moneda</dt>
                <dd>{normalizeCurrency(currentQuote.currency)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Cantidad de operaciones</dt>
                <dd>{formatQuantity(currentQuote.operationCount)}</dd>
              </div>
            </dl>
          </section>
          
          <section
            className="stock-detail-data-section stock-detail-market-depth"
            aria-labelledby="stock-detail-market-depth-title"
          >
            <div className="stock-detail-section-header">
              <h2 id="stock-detail-market-depth-title">Puntas</h2>
            </div>
            {currentQuote.depth.length === 0 ? (
              <p className="stock-detail-market-depth-empty">
                Sin puntas disponibles
              </p>
            ) : (
              <div className="stock-detail-market-depth-table-wrap">
                <table className="stock-detail-market-depth-table">
                  <thead>
                    <tr>
                      <th scope="col">Cant. compra</th>
                      <th scope="col">Precio compra</th>
                      <th scope="col">Precio venta</th>
                      <th scope="col">Cant. venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentQuote.depth.map((level, index) => (
                      <tr key={index}>
                        <td>{formatQuantity(level.buyQuantity)}</td>
                        <td className="stock-detail-market-depth-buy">
                          {formatCurrencyARS(level.buyPrice, {
                            zeroIsMissing: true,
                          })}
                        </td>
                        <td className="stock-detail-market-depth-sell">
                          {formatCurrencyARS(level.sellPrice, {
                            zeroIsMissing: true,
                          })}
                        </td>
                        <td>{formatQuantity(level.sellQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

function StockDetailsModalContent({ stock }: { stock: StockData }) {
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>(
    DEFAULT_STOCK_HISTORY_RANGE
  )
  const history = useStockHistory(stock.ticker, historyRange)
  const currentQuote = useMemo(
    () => resolveCurrentStockQuote(stock, history.points),
    [history.points, stock]
  )
  const varClass = getVariationClass(stock.varType)
  const severityClass = getVariationSeverityClass(stock.var, stock.varType)
  const primaryRows: StockDetailRow[] = [
    { label: 'Último precio', value: formatMoney(currentQuote.price) },
    {
      label: 'Variación diaria',
      value: formatSignedPercent(currentQuote.variation),
      valueClassName: `stock-var ${varClass} ${severityClass}`.trim(),
    },
    { label: 'Apertura', value: formatMoney(currentQuote.open), className: 'stock-details-market-cell' },
    { label: 'Cierre anterior', value: formatMoney(currentQuote.previousClose), className: 'stock-details-market-cell' },
    { label: 'Volumen nominal', value: formatInteger(currentQuote.volume), className: 'stock-details-market-cell' },
  ]
  const secondaryRows: StockDetailRow[] = [
    { label: 'Cantidad compra', value: formatInteger(stock.buyQty), className: 'stock-details-quote-cell' },
    { label: 'Precio compra', value: formatMoney(stock.buyPrice), className: 'stock-details-quote-cell' },
    { label: 'Precio venta', value: formatMoney(stock.sellPrice), className: 'stock-details-quote-cell' },
    { label: 'Cantidad venta', value: formatInteger(stock.sellQty), className: 'stock-details-quote-cell' },
    { label: 'Mínimo', value: formatMoney(stock.min) },
    { label: 'Máximo', value: formatMoney(stock.max) },
  ]

  return (
    <div className="stock-details-content stock-details-content-modal">
      <HistorySection
        stock={stock}
        variant="modal"
        historyRange={historyRange}
        onHistoryRangeChange={setHistoryRange}
        history={history}
      />
      <dl className="stock-details-grid stock-details-grid-primary">
        {primaryRows.map(({ label, value, className, valueClassName }) => (
          <div key={label} className={className}>
            <dt>{label}</dt>
            <dd className={valueClassName}>{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="stock-details-grid stock-details-grid-secondary">
        {secondaryRows.map(({ label, value, className, valueClassName }) => (
          <div key={label} className={className}>
            <dt>{label}</dt>
            <dd className={valueClassName}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function StockDetailsContent(props: StockDetailsContentProps) {
  if (props.variant === 'page') {
    return (
      <div className="stock-details-content stock-details-content-page">
        <HistorySection
          stock={props.stock}
          variant="page"
          historyRange={props.historyRange}
          onHistoryRangeChange={props.onHistoryRangeChange}
          history={props.history}
          quoteDetail={props.quoteDetail}
        />
      </div>
    )
  }

  return <StockDetailsModalContent stock={props.stock} />
}
