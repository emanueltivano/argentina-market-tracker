import { memo, type FC } from 'react'
import { STOCK_GRID_LAYOUT } from './stockGrid'

export interface StockProps {
  ticker: string
  price: number | null
  var: number | null
  varType: 'positive' | 'negative' | 'neutral'
  buyQty: number | null
  buyPrice: number | null
  sellPrice: number | null
  sellQty: number | null
  open: number | null
  min: number | null
  max: number | null
  close: number | null
  volume: number | null
  trades: number | null
}

function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  locale = 'es-AR'
): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—'
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value))
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—'
  }

  return `$ ${formatNumber(value)}`
}

function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0)
}

function formatSignedPercent(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—'
  }

  const n = Number(value)

  if (n === 0) {
    return `${formatNumber(0, decimals)}%`
  }

  const sign = n > 0 ? '+ ' : '- '
  return `${sign}${formatNumber(Math.abs(n), decimals)}%`
}

function getVariationAriaLabel(
  value: number | null,
  type: StockProps['varType']
): string {
  if (value === null) {
    return 'Variación no disponible'
  }

  return `Variación ${type} ${formatNumber(Math.abs(value))}%`
}

/** Misma grilla que NavStocks */
const GRID = `${STOCK_GRID_LAYOUT} text-sm`

const Stock: FC<StockProps> = (props) => {
  const varClass =
    props.varType === 'positive'
      ? 'text-emerald-400'
      : props.varType === 'negative'
        ? 'text-red-400'
        : 'text-black/70'

  return (
    <div className={`${GRID} tabular-nums`} role="row" data-symbol={props.ticker}>
      <div className="justify-self-start text-left font-mono">
        {props.ticker}
      </div>

      <span>{formatMoney(props.price)}</span>

      <span
        className={varClass}
        aria-label={getVariationAriaLabel(props.var, props.varType)}
      >
        {formatSignedPercent(props.var)}
      </span>

      <span>{formatInteger(props.buyQty)}</span>
      <span>{formatMoney(props.buyPrice)}</span>
      <span>{formatMoney(props.sellPrice)}</span>
      <span>{formatInteger(props.sellQty)}</span>

      <span>{formatMoney(props.open)}</span>
      <span>{formatMoney(props.min)}</span>
      <span>{formatMoney(props.max)}</span>
      <span>{formatMoney(props.close)}</span>

      <span>{formatInteger(props.volume)}</span>
      <span>{formatInteger(props.trades)}</span>
    </div>
  )
}

export default memo(Stock)