'use client'

import { useState } from 'react'
import { type StockData } from '../lib/stockData'
import LightweightStockChart from './LightweightStockChart'
import {
  formatMoney,
  formatInteger,
  formatSignedPercent,
} from '@/lib/formatters'
import {
  DEFAULT_STOCK_HISTORY_RANGE,
  STOCK_HISTORY_RANGES,
  type StockHistoryPoint,
  type StockHistoryRange,
} from '@/lib/stockHistory'
import { useStockHistory } from '../hooks/useStockHistory'
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

function getHistoryPeriodVariation(points: StockHistoryPoint[]) {
  const first = points[0]
  const last = points.at(-1)

  if (!first || !last || first.close === 0) {
    return null
  }

  return ((last.close - first.close) / first.close) * 100
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
  const historyVariation = getHistoryPeriodVariation(historyPoints)
  const historyVariationClass = getHistoryVariationClass(historyVariation)
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

  const primaryDetailRows: StockDetailRow[] = [
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

  const secondaryDetailRows: StockDetailRow[] = [
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
      <section className="stock-history-section" aria-label="Histórico">
        <div className="stock-history-header">
          <div className="stock-history-heading">
            <div>
              <h3 className="stock-history-title">Histórico</h3>
              <p className="stock-history-subtitle">
                {HISTORY_RANGE_LABEL[historyRange]}
              </p>
              {historyMetaMessage && (
                <p className="stock-history-subtitle stock-history-subtitle-meta">
                  {historyMetaMessage}
                </p>
              )}
            </div>

            {historyStatus === 'success' && historyVariation !== null && (
              <span
                className={`stock-history-performance ${historyVariationClass}`}
              >
                {formatSignedPercent(historyVariation)}
              </span>
            )}
          </div>

          <div className="stock-history-range-group" aria-label="Rango">
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
            <LightweightStockChart points={historyPoints} symbol={stock.ticker} />
          </div>
        )}
      </section>

      <dl className="stock-details-grid stock-details-grid-primary">
        {primaryDetailRows.map(({ label, value, className, valueClassName }) => (
          <div key={label} className={className}>
            <dt>{label}</dt>
            <dd className={valueClassName}>{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="stock-details-grid stock-details-grid-secondary">
        {secondaryDetailRows.map(({ label, value, className, valueClassName }) => (
          <div key={label} className={className}>
            <dt>{label}</dt>
            <dd className={valueClassName}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
