import { memo, type FC } from 'react';
import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockGrid';
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

export interface StockProps extends StockData {
  onSelect?: (stock: StockData) => void;
  canOpenDetails?: boolean;
}

function getVariationAriaLabel(
  value: number | null,
  type: StockData['varType'],
): string {
  if (value === null) {
    return 'Variación no disponible';
  }

  const labelByType: Record<StockData['varType'], string> = {
    positive: 'positiva',
    negative: 'negativa',
    neutral: 'neutral',
  };

  return `Variación ${labelByType[type]} ${formatNumber(Math.abs(value))}%`;
}

const GRID = STOCK_GRID_LAYOUT;

const Stock: FC<StockProps> = (props) => {
  const { onSelect, canOpenDetails = false, ...stock } = props;

  const varClass =
    stock.varType === 'positive'
      ? 'stock-var-positive'
      : stock.varType === 'negative'
        ? 'stock-var-negative'
        : 'stock-var-neutral';

  const strengthClass =
    stock.var !== null && Math.abs(stock.var) >= 3 ? 'stock-var-strong' : '';

  function handleTickerClick() {
    if (canOpenDetails) {
      onSelect?.(stock);
    }
  }

  return (
    <tr className={`${GRID} stock-row`} data-symbol={stock.ticker}>
      <th
        scope="row"
        className="stock-cell stock-ticker justify-self-start text-left font-mono"
        title={stock.description}
      >
        {canOpenDetails ? (
          <button
            type="button"
            className="stock-ticker-button"
            onClick={handleTickerClick}
            aria-label={`Ver más información de ${stock.ticker}`}
          >
            {stock.ticker}
          </button>
        ) : (
          stock.ticker
        )}
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
        {formatInteger(stock.buyQty)}
      </td>

      <td className={`stock-cell stock-buy ${STOCK_COLUMN_VISIBILITY.tabletUp}`}>
        {formatMoney(stock.buyPrice)}
      </td>

      <td
        className={`stock-cell stock-sell ${STOCK_COLUMN_VISIBILITY.tabletUp}`}
      >
        {formatMoney(stock.sellPrice)}
      </td>

      <td
        className={`stock-cell stock-sell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        {formatInteger(stock.sellQty)}
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
};

export default memo(Stock);
