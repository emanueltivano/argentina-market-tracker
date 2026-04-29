import { memo, type FC } from 'react';
import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockGrid';

export interface StockProps {
  ticker: string;
  description: string;
  price: number | null;
  var: number | null;
  varType: 'positive' | 'negative' | 'neutral';
  buyQty: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  sellQty: number | null;
  open: number | null;
  min: number | null;
  max: number | null;
  close: number | null;
  volume: number | null;
}

function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  locale = 'es-AR',
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

function formatMoney(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return `$ ${formatNumber(value)}`;
}

function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0);
}

function formatSignedPercent(value: number | null | undefined, decimals = 2) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  const n = Number(value);

  if (n === 0) {
    return `${formatNumber(0, decimals)}%`;
  }

  const sign = n > 0 ? '+ ' : '- ';
  return `${sign}${formatNumber(Math.abs(n), decimals)}%`;
}

function getVariationAriaLabel(
  value: number | null,
  type: StockProps['varType'],
): string {
  if (value === null) {
    return 'Variación no disponible';
  }

  return `Variación ${type} ${formatNumber(Math.abs(value))}%`;
}

const GRID = STOCK_GRID_LAYOUT;

const Stock: FC<StockProps> = (props) => {
  const varClass =
    props.varType === 'positive'
      ? 'stock-var-positive'
      : props.varType === 'negative'
        ? 'stock-var-negative'
        : 'stock-var-neutral';

  const strengthClass =
    props.var !== null && Math.abs(props.var) >= 3 ? 'stock-var-strong' : '';

  return (
    <tr className={`${GRID} stock-row`} data-symbol={props.ticker}>
      <th
        scope="row"
        className="stock-cell stock-ticker justify-self-start text-left font-mono"
        title={`${props.description}`}
      >
        {props.ticker}
      </th>

      <td className="stock-cell stock-price">
        {formatMoney(props.price)}
      </td>

      <td
        className="stock-cell"
        aria-label={getVariationAriaLabel(props.var, props.varType)}
      >
        <span className={`stock-var ${varClass} ${strengthClass}`}>
          {formatSignedPercent(props.var)}
        </span>
      </td>

      <td
        className={`stock-cell stock-buy ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatInteger(props.buyQty)}
      </td>

      <td className="stock-cell stock-buy">
        {formatMoney(props.buyPrice)}
      </td>

      <td className="stock-cell stock-sell">
        {formatMoney(props.sellPrice)}
      </td>

      <td
        className={`stock-cell stock-sell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatInteger(props.sellQty)}
      </td>

      <td
        className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatMoney(props.open)}
      </td>

      <td
        className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatMoney(props.min)}
      </td>

      <td
        className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatMoney(props.max)}
      </td>

      <td
        className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatMoney(props.close)}
      </td>

      <td
        className={`stock-cell ${STOCK_COLUMN_VISIBILITY.tabletUp}`}
      >
        {formatInteger(props.volume)}
      </td>
    </tr>
  );
};

export default memo(Stock);
