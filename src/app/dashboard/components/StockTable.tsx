import { type ReactNode } from 'react';
import NavStocks from './NavStocks';
import { DEFAULT_STOCK_SORT, type StockSort, type StockSortKey } from './stockSorting';
import { STOCK_COLUMN_VISIBILITY } from './stockTableLayout';

const STOCK_TABLE_COLUMN_COUNT = 13;
const STOCK_TABLE_SKELETON_CELLS = [
  'stock-favorite-cell',
  '',
  '',
  'stock-cell-center',
  `${STOCK_COLUMN_VISIBILITY.desktopOnly} stock-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.tabletUp} stock-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.tabletUp} stock-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.desktopOnly} stock-cell-center`,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.tabletUp,
] as const;

type StockTableProps = {
  children: ReactNode;
  isBusy: boolean;
  sort?: StockSort;
  onSortChange?: (key: StockSortKey) => void;
};

export function StockTable({
  children,
  isBusy,
  sort = DEFAULT_STOCK_SORT,
  onSortChange = () => undefined,
}: StockTableProps) {
  return (
    <table className='stock-table' aria-busy={isBusy}>
      <caption className='sr-only'>Panel de acciones</caption>
      <NavStocks sort={sort} onSortChange={onSortChange} />
      <tbody className='divide-y divide-gray-200'>{children}</tbody>
    </table>
  );
}

export function StockTableStatus({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td className='stock-status-cell' colSpan={STOCK_TABLE_COLUMN_COUNT}>
        {children}
      </td>
    </tr>
  );
}

export function StockTableLoadingState() {
  const skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  return (
    <>
      {skeletonRows.map((row) => (
        <tr
          key={row}
          className='stock-row stock-row-skeleton'
          data-testid='stock-table-skeleton-row'
          aria-hidden='true'
        >
          {STOCK_TABLE_SKELETON_CELLS.map((className, cell) => (
            <td key={cell} className={`stock-cell ${className}`}>
              <span className='stock-skeleton-bar' />
            </td>
          ))}
        </tr>
      ))}
      <tr className='sr-only'>
        <td colSpan={STOCK_TABLE_COLUMN_COUNT} role='status' aria-live='polite'>
          Cargando datos...
        </td>
      </tr>
    </>
  );
}

export function StockTableErrorState({ message }: { message: string }) {
  return (
    <StockTableStatus>
      <div className='stock-table-state stock-table-state-error' role='alert'>
        <p>Error cargando datos: {message}</p>
      </div>
    </StockTableStatus>
  );
}

export function StockTableEmptyState() {
  return (
    <StockTableStatus>
      <div className='stock-table-state' role='status' aria-live='polite'>
        <p>No hay datos disponibles.</p>
      </div>
    </StockTableStatus>
  );
}

export function StockTableFavoritesEmptyState() {
  return (
    <StockTableStatus>
      <div className='stock-table-state' role='status' aria-live='polite'>
        <p>Todavía no agregaste favoritos.</p>
      </div>
    </StockTableStatus>
  );
}

export function StockTableStaleErrorState() {
  return (
    <p className='stock-table-stale-error' role='status' aria-live='polite'>
      No se pudo actualizar. Mostrando últimos datos disponibles.
    </p>
  );
}
