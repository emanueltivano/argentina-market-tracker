import { memo } from 'react';
import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockTableLayout';
import {
  formatMoney,
  formatInteger,
  formatNumber,
  formatSignedPercent,
} from '@/lib/formatters';

export interface StockData {
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

const VARIATION_LABEL_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'positiva',
  negative: 'negativa',
  neutral: 'neutral',
};

export interface StockProps extends StockData {
  onSelect?: (stock: StockData) => void;
}

function getVariationAriaLabel(
  value: number | null,
  type: StockData['varType'],
): string {
  if (value === null) {
    return 'Variación no disponible';
  }

  return `Variación ${VARIATION_LABEL_BY_TYPE[type]} ${formatNumber(Math.abs(value))}%`;
}

const GRID = STOCK_GRID_LAYOUT;

const VAR_CLASS_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'stock-var-positive',
  negative: 'stock-var-negative',
  neutral: 'stock-var-neutral',
};

function Stock(props: StockProps) {
  const { onSelect, ...stock } = props;

  const varClass = VAR_CLASS_BY_TYPE[stock.varType];
  const strengthClass =
    stock.var !== null && Math.abs(stock.var) >= 3 ? 'stock-var-strong' : '';

  function handleSelect() {
    onSelect?.(stock);
  }

  return (
    <tr
      className={`${GRID} stock-row stock-row-interactive`}
      data-symbol={stock.ticker}
      onClick={handleSelect}
    >
      <th
        scope="row"
        className="stock-cell stock-ticker justify-self-start text-left font-mono"
        title={stock.description}
      >
        <button
          type="button"
          className="stock-ticker-button"
          onClick={(event) => {
            event.stopPropagation();
            handleSelect();
          }}
          aria-label={`Abrir detalle de ${stock.ticker}, ${stock.description}`}
        >
          {stock.ticker}
        </button>
      </th>

      <td className="stock-cell stock-price">{formatMoney(stock.price)}</td>

      <td
        className="stock-cell"
        aria-label={getVariationAriaLabel(stock.var, stock.varType)}
      >
        <span className={`stock-var ${varClass} ${strengthClass}`}>
          {formatSignedPercent(stock.var)}
        </span>
      </td>

      <td
        className={`stock-cell stock-buy ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        <span>{formatInteger(stock.buyQty)}</span>
      </td>

      <td className={`stock-cell stock-buy ${STOCK_COLUMN_VISIBILITY.tabletUp}`}>
        <span>{formatMoney(stock.buyPrice)}</span>
      </td>

      <td
        className={`stock-cell stock-sell ${STOCK_COLUMN_VISIBILITY.tabletUp}`}
      >
        <span>{formatMoney(stock.sellPrice)}</span>
      </td>

      <td
        className={`stock-cell stock-sell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        <span>{formatInteger(stock.sellQty)}</span>
      </td>

      <td className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}>
        {formatMoney(stock.open)}
      </td>

      <td className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}>
        {formatMoney(stock.min)}
      </td>

      <td className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}>
        {formatMoney(stock.max)}
      </td>

      <td className={`stock-cell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}>
        {formatMoney(stock.close)}
      </td>

      <td className={`stock-cell ${STOCK_COLUMN_VISIBILITY.tabletUp}`}>
        {formatInteger(stock.volume)}
      </td>
    </tr>
  );
}

export default memo(Stock);
