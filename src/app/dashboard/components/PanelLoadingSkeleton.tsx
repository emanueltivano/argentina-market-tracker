import { StockTableLoadingState } from './StockTable';
import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockTableLayout';

const SKELETON_HEADER_CELLS = [
  'stock-favorite-cell',
  'font-medium text-left',
  '',
  'nav-stocks-cell-center',
  `${STOCK_COLUMN_VISIBILITY.desktopOnly} nav-stocks-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.tabletUp} nav-stocks-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.tabletUp} nav-stocks-cell-center`,
  `${STOCK_COLUMN_VISIBILITY.desktopOnly} nav-stocks-cell-center`,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.desktopOnly,
  STOCK_COLUMN_VISIBILITY.tabletUp,
] as const;

function SkeletonBar({ className = '' }: { className?: string }) {
  return <span className={`stock-skeleton-bar ${className}`} />;
}

export default function PanelLoadingSkeleton() {
  return (
    <section
      className="dashboard-container py-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="sr-only" role="status">
        Cargando panel
      </div>

      <div className="page-title panel-title-skeleton" aria-hidden="true">
        <SkeletonBar />
      </div>

      <div className="panel-toolbar" aria-hidden="true">
        <div className="panel-menu panel-menu-skeleton">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="panel-menu-button panel-skeleton-pill">
              <SkeletonBar />
            </span>
          ))}
        </div>

        <div className="panel-actions">
          <span className="theme-toggle-button panel-skeleton-icon">
            <SkeletonBar />
          </span>
          <PanelFreshnessSkeleton />
        </div>
      </div>

      <div className="stock-table-container">
        <table className="stock-table" aria-busy="true">
          <caption className="sr-only">Panel de acciones</caption>
          <thead aria-hidden="true">
            <tr className={`${STOCK_GRID_LAYOUT} nav-stocks stock-row-skeleton`}>
              {SKELETON_HEADER_CELLS.map((className, cell) => (
                <th
                  key={cell}
                  scope="col"
                  className={`nav-stocks-cell ${className}`}
                >
                  <SkeletonBar />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <StockTableLoadingState />
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PanelFreshnessSkeleton() {
  return (
    <div className="panel-refresh panel-refresh-skeleton" aria-hidden="true">
      <SkeletonBar className="panel-refresh-time-skeleton" />
      <span className="panel-refresh-button panel-skeleton-button">
        <SkeletonBar />
      </span>
    </div>
  );
}
