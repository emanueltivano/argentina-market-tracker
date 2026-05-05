import { useEffect, useId, useRef } from 'react';
import { type StockData } from './Stock';
import {
  formatMoney,
  formatInteger,
  formatSignedPercent,
} from '@/lib/formatters';

type StockDetailsModalProps = {
  stock: StockData;
  onClose: () => void;
};

export default function StockDetailsModal({
  stock,
  onClose,
}: StockDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const activeElement = document.activeElement;

    if (!dialog) {
      return;
    }

    openerRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;

    if (!dialog.open) {
      dialog.showModal();
    }

    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      if (openerRef.current?.isConnected) {
        openerRef.current.focus();
      }
    };
  }, []);

  const detailRows = [
    ['Último precio', formatMoney(stock.price)],
    ['Variación', formatSignedPercent(stock.var)],
    ['Cantidad compra', formatInteger(stock.buyQty)],
    ['Precio compra', formatMoney(stock.buyPrice)],
    ['Precio venta', formatMoney(stock.sellPrice)],
    ['Cantidad venta', formatInteger(stock.sellQty)],
    ['Apertura', formatMoney(stock.open)],
    ['Mínimo', formatMoney(stock.min)],
    ['Máximo', formatMoney(stock.max)],
    ['Último cierre', formatMoney(stock.close)],
    ['Volumen', formatInteger(stock.volume)],
  ];

  return (
    <dialog
      ref={dialogRef}
      className="stock-details-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="stock-details-modal">
        <header className="stock-details-header">
          <div>
            <h2 id={titleId} className="stock-details-title">
              {stock.ticker}
            </h2>
            <p className="stock-details-description">{stock.description}</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="stock-details-close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            Cerrar
          </button>
        </header>

        <dl className="stock-details-grid">
          {detailRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
