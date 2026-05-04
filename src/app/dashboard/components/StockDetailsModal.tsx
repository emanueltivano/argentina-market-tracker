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
          <div>
            <dt>Último precio</dt>
            <dd>{formatMoney(stock.price)}</dd>
          </div>
          <div>
            <dt>Variación</dt>
            <dd>{formatSignedPercent(stock.var)}</dd>
          </div>
          <div>
            <dt>Cantidad compra</dt>
            <dd>{formatInteger(stock.buyQty)}</dd>
          </div>
          <div>
            <dt>Precio compra</dt>
            <dd>{formatMoney(stock.buyPrice)}</dd>
          </div>
          <div>
            <dt>Precio venta</dt>
            <dd>{formatMoney(stock.sellPrice)}</dd>
          </div>
          <div>
            <dt>Cantidad venta</dt>
            <dd>{formatInteger(stock.sellQty)}</dd>
          </div>
          <div>
            <dt>Apertura</dt>
            <dd>{formatMoney(stock.open)}</dd>
          </div>
          <div>
            <dt>Mínimo</dt>
            <dd>{formatMoney(stock.min)}</dd>
          </div>
          <div>
            <dt>Máximo</dt>
            <dd>{formatMoney(stock.max)}</dd>
          </div>
          <div>
            <dt>Último cierre</dt>
            <dd>{formatMoney(stock.close)}</dd>
          </div>
          <div>
            <dt>Volumen</dt>
            <dd>{formatInteger(stock.volume)}</dd>
          </div>
        </dl>
      </div>
    </dialog>
  );
}
