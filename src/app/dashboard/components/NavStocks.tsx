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
  {
    label: 'PC',
    title: 'Precio de compra',
    className: STOCK_COLUMN_VISIBILITY.tabletUp,
  },
  {
    label: 'PV',
    title: 'Precio de venta',
    className: STOCK_COLUMN_VISIBILITY.tabletUp,
  },
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
];

const GRID = STOCK_GRID_LAYOUT;

export default function NavStocks() {
  return (
    <thead>
      <tr className={`${GRID} nav-stocks`}>
        {COLUMNS.map((column) => (
          <th
            key={column.label}
            scope="col"
            className={`nav-stocks-cell ${column.className ?? ''}`}
          >
            {column.title ? (
              <abbr title={column.title}>{column.label}</abbr>
            ) : (
              column.label
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}
