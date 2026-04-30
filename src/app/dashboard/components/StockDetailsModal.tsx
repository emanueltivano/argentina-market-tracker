import { useEffect, useId, useRef } from 'react';
import { type StockData } from './Stock';

type StockDetailsModalProps = {
  stock: StockData;
  onClose: () => void;
};

function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  locale = 'es-AR',
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

function formatMoney(value: number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  return `$ ${formatNumber(value)}`;
}

function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0);
}

function formatSignedPercent(value: number | null | undefined, decimals = 2) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—';
  }

  const n = Number(value);

  if (n === 0) {
    return `${formatNumber(0, decimals)}%`;
  }

  const sign = n > 0 ? '+ ' : '- ';
  return `${sign}${formatNumber(Math.abs(n), decimals)}%`;
}

export default function StockDetailsModal({
  stock,
  onClose,
}: StockDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="stock-details-dialog"
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
