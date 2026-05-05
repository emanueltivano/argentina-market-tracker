import { type ReactNode } from 'react';
import NavStocks from './NavStocks';

const STOCK_TABLE_COLUMN_COUNT = 12;

type StockTableProps = {
  children: ReactNode;
  isBusy: boolean;
};

export function StockTable({ children, isBusy }: StockTableProps) {
  return (
    <table className='stock-table' aria-busy={isBusy}>
      <caption className='sr-only'>Panel de acciones</caption>
      <NavStocks />
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
