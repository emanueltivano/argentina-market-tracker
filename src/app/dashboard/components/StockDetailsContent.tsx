'use client'

import { useMemo, useState } from 'react'
import { type StockData } from '../lib/stockData'
import LightweightStockChart from './LightweightStockChart'
import AdvancedStockDetailChart from './AdvancedStockDetailChart'
import {
  formatMoney,
  formatInteger,
  formatSignedPercent,
} from '@/lib/formatters'
import {
  DEFAULT_STOCK_HISTORY_RANGE,
  STOCK_HISTORY_RANGES,
  type StockHistoryRange,
} from '@/lib/stockHistory'
import { useStockHistory } from '../hooks/useStockHistory'
import {
  calculatePeriodMetrics,
  mergeTodayQuoteIntoHistory,
  normalizeHistoryPoints,
} from '../lib/advancedStockChart'
import { getVariationSeverityClass } from './stockVariationSeverity'

type StockDetailsContentProps = {
  stock: StockData
  variant?: 'modal' | 'page'
}

type StockDetailRow = {
  label: string
  value: string
  className?: string
  valueClassName?: string
}

const VAR_CLASS_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'stock-var-positive',
  negative: 'stock-var-negative',
  neutral: 'stock-var-neutral',
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

export default function StockDetailsContent({
  stock,
  variant = 'modal',
}: StockDetailsContentProps) {
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>(
    DEFAULT_STOCK_HISTORY_RANGE
  )
  const {
    points: historyPoints,
    meta: historyMeta,
    error: historyError,
    isLoading: isHistoryLoading,
    isRefreshing: isHistoryRefreshing,
    viewStatus: historyStatus,
  } = useStockHistory(stock.ticker, historyRange)

  const varClass = VAR_CLASS_BY_TYPE[stock.varType]
  const severityClass = getVariationSeverityClass(stock.var, stock.varType)
  const chartHistoryPoints = useMemo(
    () =>
      variant === 'page'
        ? mergeTodayQuoteIntoHistory(historyPoints, stock)
        : historyPoints,
    [historyPoints, stock, variant]
  )
  const normalizedHistoryPoints = useMemo(
    () => normalizeHistoryPoints(chartHistoryPoints),
    [chartHistoryPoints]
  )
  const periodMetrics = useMemo(
    () => calculatePeriodMetrics(normalizedHistoryPoints),
    [normalizedHistoryPoints]
  )
  const historyVariation = periodMetrics?.periodVariation ?? null
  const historyVariationClass = getHistoryVariationClass(historyVariation)
  const historyDataStatus = historyMeta
    ? historyMeta.stale
      ? 'Stale'
      : historyMeta.source === 'demo'
        ? 'Demo'
        : 'Live'
    : null
  const historyMetaMessage =
    historyStatus === 'success' && historyMeta
      ? historyMeta.stale
        ? 'Mostrando histórico cacheado por una falla temporal del upstream.'
        : historyMeta.discardedPoints > 0
          ? `Se descartaron ${historyMeta.discardedPoints} de ${historyMeta.totalPoints} puntos inválidos del upstream.`
          : historyMeta.source === 'demo'
            ? 'Serie histórica de demo determinística.'
            : null
      : null
  const historyRangeControls = (
    <div className="stock-history-range-control">
      <span className="stock-history-control-label">Período</span>
      <div className="stock-history-range-group" aria-label="Período">
        {STOCK_HISTORY_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            className={
              range === historyRange
                ? 'stock-history-range-button stock-history-range-button-active'
                : 'stock-history-range-button'
            }
            onClick={() => setHistoryRange(range)}
            aria-pressed={range === historyRange}
            title={HISTORY_RANGE_LABEL[range]}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  )

  const modalPrimaryDetailRows: StockDetailRow[] = [
    { label: 'Último precio', value: formatMoney(stock.price) },
    {
      label: 'Variación diaria',
      value: formatSignedPercent(stock.var),
      valueClassName: `stock-var ${varClass} ${severityClass}`.trim(),
    },
    {
      label: 'Apertura',
      value: formatMoney(stock.open),
      className: 'stock-details-market-cell',
    },
    {
      label: 'Último cierre',
      value: formatMoney(stock.close),
      className: 'stock-details-market-cell',
    },
    {
      label: 'Volumen',
      value: formatInteger(stock.volume),
      className: 'stock-details-market-cell',
    },
  ]

  const modalSecondaryDetailRows: StockDetailRow[] = [
    {
      label: 'Cantidad compra',
      value: formatInteger(stock.buyQty),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Precio compra',
      value: formatMoney(stock.buyPrice),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Precio venta',
      value: formatMoney(stock.sellPrice),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Cantidad venta',
      value: formatInteger(stock.sellQty),
      className: 'stock-details-quote-cell',
    },
    { label: 'Mínimo', value: formatMoney(stock.min) },
    { label: 'Máximo', value: formatMoney(stock.max) },
  ]

  return (
    <div className={`stock-details-content stock-details-content-${variant}`}>
      <section
        className="stock-history-section"
        aria-labelledby="stock-history-title"
      >
        <div className="stock-history-header">
          <div className="stock-history-heading">
            <div>
              <h2 id="stock-history-title" className="stock-history-title">
                Histórico
              </h2>
              <p className="stock-history-subtitle">
                {HISTORY_RANGE_LABEL[historyRange]}:{' '}
                {historyStatus === 'success' && historyVariation !== null ? (
                  <span
                    className={`stock-history-performance ${historyVariationClass}`}
                  >
                    {formatSignedPercent(historyVariation)}
                  </span>
                ) : (
                  <span className="stock-history-performance stock-history-performance-neutral">
                    -
                  </span>
                )}
              </p>
              {historyMetaMessage && (
                <p className="stock-history-subtitle stock-history-subtitle-meta">
                  {historyMetaMessage}
                </p>
              )}
            </div>
          </div>

          {variant === 'modal' && historyRangeControls}
        </div>

        {isHistoryLoading && (
          <div className="stock-history-state" role="status">
            Cargando histórico...
          </div>
        )}

        {historyStatus === 'error' && (
          <div className="stock-history-state stock-history-state-error" role="alert">
            {historyError?.message ?? 'No se pudo cargar el histórico.'}
          </div>
        )}

        {historyStatus === 'empty' && (
          <div className="stock-history-state">
            <strong>Sin histórico disponible</strong>
            <span>No hay datos históricos para este rango.</span>
          </div>
        )}

        {historyStatus === 'success' && (
          <div
            className={
              isHistoryRefreshing
                ? 'stock-history-chart-wrap stock-history-chart-wrap-refreshing'
                : 'stock-history-chart-wrap'
            }
          >
            {variant === 'page' ? (
              <AdvancedStockDetailChart
                points={chartHistoryPoints}
                symbol={stock.ticker}
                rangeControls={historyRangeControls}
              />
            ) : (
              <LightweightStockChart
                points={historyPoints}
                symbol={stock.ticker}
              />
            )}
          </div>
        )}
      </section>

      {variant === 'page' && (
        <>
          {periodMetrics && historyStatus === 'success' && (
            <section
              className="stock-detail-period-metrics"
              aria-label="Métricas del período"
            >
              <div className="stock-detail-period-metric">
                <span>Precio actual</span>
                <strong>{formatMoney(periodMetrics.currentPrice)}</strong>
              </div>
              <div className="stock-detail-period-metric">
                <span>Variación del período</span>
                <strong className={historyVariationClass}>
                  {historyVariation === null
                    ? '-'
                    : formatSignedPercent(historyVariation)}
                </strong>
              </div>
              <div className="stock-detail-period-metric">
                <span>Máximo del período</span>
                <strong>{formatMoney(periodMetrics.periodHigh)}</strong>
              </div>
              <div className="stock-detail-period-metric">
                <span>Mínimo del período</span>
                <strong>{formatMoney(periodMetrics.periodLow)}</strong>
              </div>
            </section>
          )}

          <section
            className="stock-detail-quote-section"
            aria-labelledby="stock-detail-quote-title"
          >
            <div className="stock-detail-section-header">
              <h2 id="stock-detail-quote-title">Datos de cotización</h2>
            </div>

            <dl className="stock-detail-secondary-grid">
              <div className="stock-detail-secondary-metric">
                <dt>Apertura</dt>
                <dd>{formatMoney(stock.open)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Último cierre</dt>
                <dd>{formatMoney(stock.close)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Mínimo diario</dt>
                <dd>{formatMoney(stock.min)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Máximo diario</dt>
                <dd>{formatMoney(stock.max)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Variación diaria</dt>
                <dd
                  className={`stock-var stock-detail-secondary-variation ${varClass} ${severityClass}`.trim()}
                >
                  {formatSignedPercent(stock.var)}
                </dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Volumen</dt>
                <dd>{formatInteger(stock.volume)}</dd>
              </div>
              <div className="stock-detail-secondary-metric">
                <dt>Estado de datos</dt>
                <dd>{historyDataStatus ?? '-'}</dd>
              </div>
            </dl>

            <section
              className="stock-detail-market-depth-section"
              aria-labelledby="stock-detail-market-depth-title"
            >
              <h3 id="stock-detail-market-depth-title">Puntas</h3>
              <dl className="stock-detail-secondary-grid">
                <div className="stock-detail-secondary-metric">
                  <dt>Cantidad de compra</dt>
                  <dd>{formatInteger(stock.buyQty)}</dd>
                </div>
                <div className="stock-detail-secondary-metric">
                  <dt>Precio de compra</dt>
                  <dd>{formatMoney(stock.buyPrice)}</dd>
                </div>
                <div className="stock-detail-secondary-metric">
                  <dt>Precio de venta</dt>
                  <dd>{formatMoney(stock.sellPrice)}</dd>
                </div>
                <div className="stock-detail-secondary-metric">
                  <dt>Cantidad de venta</dt>
                  <dd>{formatInteger(stock.sellQty)}</dd>
                </div>
              </dl>
            </section>
          </section>
        </>
      )}

      {variant === 'modal' && (
        <>
          <dl className="stock-details-grid stock-details-grid-primary">
            {modalPrimaryDetailRows.map(
              ({ label, value, className, valueClassName }) => (
                <div key={label} className={className}>
                  <dt>{label}</dt>
                  <dd className={valueClassName}>{value}</dd>
                </div>
              )
            )}
          </dl>

          <dl className="stock-details-grid stock-details-grid-secondary">
            {modalSecondaryDetailRows.map(
              ({ label, value, className, valueClassName }) => (
                <div key={label} className={className}>
                  <dt>{label}</dt>
                  <dd className={valueClassName}>{value}</dd>
                </div>
              )
            )}
          </dl>
        </>
      )}
    </div>
  )
}
