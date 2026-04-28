import { STOCK_COLUMN_VISIBILITY, STOCK_GRID_LAYOUT } from './stockGrid';

const COLUMNS = [
  { label: 'Ticker', className: 'font-medium text-left' },
  { label: 'Precio' },
  { label: 'Var %', title: 'Variación porcentual' },
  {
    label: 'CC',
    title: 'Cantidad de compra',
    className: STOCK_COLUMN_VISIBILITY.desktopOnly,
  },
  { label: 'PC', title: 'Precio de compra' },
  { label: 'PV', title: 'Precio de venta' },
  {
    label: 'CV',
    title: 'Cantidad de venta',
    className: STOCK_COLUMN_VISIBILITY.desktopOnly,
  },
  { label: 'Apertura', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Mínimo', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Máximo', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Último cierre', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
  { label: 'Total operado', className: STOCK_COLUMN_VISIBILITY.tabletUp },
  { label: 'Operaciones', className: STOCK_COLUMN_VISIBILITY.desktopOnly },
];

const GRID = STOCK_GRID_LAYOUT;

export default function NavStocks() {
  return (
    <div
      className={`${GRID} nav-stocks`}
      role='row'
      aria-label='Encabezados de columnas'
    >
      {COLUMNS.map((column) => (
        <span
          key={column.label}
          role='columnheader'
          className={`nav-stocks-cell ${column.className ?? ''}`}
        >
          {column.title ? (
            <abbr title={column.title}>{column.label}</abbr>
          ) : (
            column.label
          )}
        </span>
      ))}
    </div>
  );
}
