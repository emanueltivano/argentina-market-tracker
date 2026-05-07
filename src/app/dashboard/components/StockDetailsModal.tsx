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

const VAR_CLASS_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'stock-var-positive',
  negative: 'stock-var-negative',
  neutral: 'stock-var-neutral',
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

  const varClass = VAR_CLASS_BY_TYPE[stock.varType];
  const strengthClass =
    stock.var !== null && Math.abs(stock.var) >= 3 ? 'stock-var-strong' : '';

  const detailRows = [
    { label: 'Último precio', value: formatMoney(stock.price) },
    {
      label: 'Variación',
      value: formatSignedPercent(stock.var),
      valueClassName: `stock-var ${varClass} ${strengthClass}`.trim(),
    },
    {
      label: 'Cantidad compra',
      value: formatInteger(stock.buyQty),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Precio compra',
      value: formatMoney(stock.buyPrice),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Precio venta',
      value: formatMoney(stock.sellPrice),
      className: 'stock-details-quote-cell',
    },
    {
      label: 'Cantidad venta',
      value: formatInteger(stock.sellQty),
      className: 'stock-details-quote-cell',
    },
    { label: 'Apertura', value: formatMoney(stock.open) },
    { label: 'Mínimo', value: formatMoney(stock.min) },
    { label: 'Máximo', value: formatMoney(stock.max) },
    { label: 'Último cierre', value: formatMoney(stock.close) },
    { label: 'Volumen', value: formatInteger(stock.volume) },
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
          {detailRows.map(({ label, value, className, valueClassName }) => (
            <div key={label} className={className}>
              <dt>{label}</dt>
              <dd className={valueClassName}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
