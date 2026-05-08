import { memo } from 'react';
import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockTableLayout';
import {
  formatMoney,
  formatInteger,
  formatNumber,
  formatSignedPercent,
} from '@/lib/formatters';
import StockFavoriteButton from './StockFavoriteButton';
import { type StockData } from '../lib/stockData';

const VARIATION_LABEL_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'positiva',
  negative: 'negativa',
  neutral: 'neutral',
};

export interface StockProps extends StockData {
  onSelect?: (stock: StockData) => void;
  isFavorite?: boolean;
  isStale?: boolean;
  onToggleFavorite?: (ticker: string) => void;
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
  const {
    isFavorite = false,
    isStale = false,
    onSelect,
    onToggleFavorite,
    ...stock
  } = props;

  const varClass = VAR_CLASS_BY_TYPE[stock.varType];
  const strengthClass =
    stock.var !== null && Math.abs(stock.var) >= 3 ? 'stock-var-strong' : '';

  function handleSelect() {
    onSelect?.(stock);
  }

  return (
    <tr
      className={`${GRID} stock-row stock-row-interactive ${
        isStale ? 'stock-row-stale' : ''
      }`}
      data-symbol={stock.ticker}
      onClick={handleSelect}
      title={isStale ? 'Dato guardado localmente' : undefined}
    >
      <td className="stock-cell stock-cell-center stock-favorite-cell">
        <StockFavoriteButton
          ticker={stock.ticker}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      </td>

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
        className="stock-cell stock-cell-center"
        aria-label={getVariationAriaLabel(stock.var, stock.varType)}
      >
        <span className={`stock-var ${varClass} ${strengthClass}`}>
          {formatSignedPercent(stock.var)}
        </span>
      </td>

      <td
        className={`stock-cell stock-cell-center stock-buy ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
      >
        <span>{formatInteger(stock.buyQty)}</span>
      </td>

      <td
        className={`stock-cell stock-cell-center stock-buy ${STOCK_COLUMN_VISIBILITY.tabletUp}`}
      >
        <span>{formatMoney(stock.buyPrice)}</span>
      </td>

      <td
        className={`stock-cell stock-cell-center stock-sell ${STOCK_COLUMN_VISIBILITY.tabletUp}`}
      >
        <span>{formatMoney(stock.sellPrice)}</span>
      </td>

      <td
        className={`stock-cell stock-cell-center stock-sell ${STOCK_COLUMN_VISIBILITY.desktopOnly}`}
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
