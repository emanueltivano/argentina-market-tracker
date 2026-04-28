import { STOCK_GRID_LAYOUT } from './stockGrid'

const COLUMNS = [
  { label: 'Ticker', className: 'font-medium text-left' },
  { label: 'Precio' },
  { label: 'Var %', title: 'Variación porcentual' },
  { label: 'CC', title: 'Cantidad de compra' },
  { label: 'PC', title: 'Precio de compra' },
  { label: 'PV', title: 'Precio de venta' },
  { label: 'CV', title: 'Cantidad de venta' },
  { label: 'Apertura' },
  { label: 'Mínimo' },
  { label: 'Máximo' },
  { label: 'Último cierre' },
  { label: 'Total operado' },
  { label: 'Operaciones' },
]

/** Misma grilla que las filas de Stock */
const GRID =
  `${STOCK_GRID_LAYOUT} border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700`

export default function NavStocks() {
  return (
    <div className={GRID} role="columnheader" aria-label="Encabezados de columnas">
      {COLUMNS.map((column) => (
        <span key={column.label} className={column.className}>
          {column.title ? (
            <abbr title={column.title}>{column.label}</abbr>
          ) : (
            column.label
          )}
        </span>
      ))}
    </div>
  )
}