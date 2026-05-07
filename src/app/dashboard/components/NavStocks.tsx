import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockTableLayout';
import {
  getNextStockSort,
  type StockSort,
  type StockSortDirection,
  type StockSortKey,
} from './stockSorting';

const COLUMNS = [
  { label: '★', title: 'Favorito', className: 'stock-favorite-cell' },
  { label: 'Ticker', sortKey: 'ticker', className: 'font-medium text-left' },
  { label: 'Precio', sortKey: 'price' },
  { label: 'Var %', sortKey: 'var', title: 'Variación porcentual', className: 'nav-stocks-cell-center' },
  {
    label: 'CC',
    title: 'Cantidad de compra',
    className: `${STOCK_COLUMN_VISIBILITY.desktopOnly} nav-stocks-cell-center`,
  },
  {
    label: 'PC',
    title: 'Precio de compra',
    className: `${STOCK_COLUMN_VISIBILITY.tabletUp} nav-stocks-cell-center`,
  },
  {
    label: 'PV',
    title: 'Precio de venta',
    className: `${STOCK_COLUMN_VISIBILITY.tabletUp} nav-stocks-cell-center`,
  },
  {
    label: 'CV',
    title: 'Cantidad de venta',
    className: `${STOCK_COLUMN_VISIBILITY.desktopOnly} nav-stocks-cell-center`,
  },
  { label: 'Apertura', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Mínimo', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Máximo', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Cierre', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Operado', sortKey: 'volume', className: STOCK_COLUMN_VISIBILITY.tabletUp },
] satisfies readonly {
  label: string;
  sortKey?: StockSortKey;
  title?: string;
  className?: string;
}[];

const GRID = STOCK_GRID_LAYOUT;

type NavStocksProps = {
  sort: StockSort;
  onSortChange: (key: StockSortKey) => void;
};

const ARIA_SORT_BY_DIRECTION: Record<StockSortDirection, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
};

const SORT_LABEL_BY_DIRECTION: Record<StockSortDirection, string> = {
  asc: 'ascendente',
  desc: 'descendente',
};

export default function NavStocks({ sort, onSortChange }: NavStocksProps) {
  return (
    <thead>
      <tr className={`${GRID} nav-stocks`}>
        {COLUMNS.map((column) => {
          const sortKey = column.sortKey;
          const isActive = sortKey === sort.key;
          const columnLabel = column.title ?? column.label;
          const nextSort = sortKey
            ? getNextStockSort(sort, sortKey)
            : null;

          return (
            <th
              key={column.label}
              scope='col'
              aria-sort={
                isActive ? ARIA_SORT_BY_DIRECTION[sort.direction] : undefined
              }
              className={`nav-stocks-cell ${column.className ?? ''}`}
            >
              {sortKey && nextSort ? (
                <button
                  type='button'
                  className={`nav-stocks-sort-button ${
                    isActive ? 'nav-stocks-sort-button-active' : ''
                  }`}
                  onClick={() => onSortChange(sortKey)}
                  aria-label={`Ordenar por ${columnLabel} ${
                    SORT_LABEL_BY_DIRECTION[nextSort.direction]
                  }`}
                >
                  <span>
                    {column.title ? (
                      <abbr title={column.title}>{column.label}</abbr>
                    ) : (
                      column.label
                    )}
                  </span>
                  <span className='nav-stocks-sort-indicator' aria-hidden='true'>
                    {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </button>
              ) : column.title ? (
                <abbr title={column.title}>{column.label}</abbr>
              ) : (
                column.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
