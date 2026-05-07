import { useEffect, useId, useRef, useState } from 'react';
import { type MarketPanelKey } from '@/lib/market';
import { type StockData } from './Stock';
import StockFavoriteButton from './StockFavoriteButton';
import StockHistoryChart from './StockHistoryChart';
import {
  formatMoney,
  formatInteger,
  formatSignedPercent,
} from '@/lib/formatters';
import {
  STOCK_HISTORY_RANGES,
  type StockHistoryPoint,
  type StockHistoryRange,
} from '@/lib/stockHistory';
import { useStockHistory } from '../hooks/useStockHistory';

type StockDetailsModalProps = {
  stock: StockData;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (ticker: string) => void;
  panelKey?: MarketPanelKey;
};

type StockDetailRow = {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
};

const VAR_CLASS_BY_TYPE: Record<StockData['varType'], string> = {
  positive: 'stock-var-positive',
  negative: 'stock-var-negative',
  neutral: 'stock-var-neutral',
};

const HISTORY_RANGE_LABEL: Record<StockHistoryRange, string> = {
  '1W': 'Última semana',
  '1M': 'Último mes',
  '3M': 'Últimos 3 meses',
  '6M': 'Últimos 6 meses',
  '1Y': 'Último año',
};

function getHistoryPeriodVariation(points: StockHistoryPoint[]) {
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last || first.close === 0) {
    return null;
  }

  return ((last.close - first.close) / first.close) * 100;
}

function getHistoryVariationClass(value: number | null): string {
  if (value === null || value === 0) {
    return 'stock-history-performance-neutral';
  }

  return value > 0
    ? 'stock-history-performance-positive'
    : 'stock-history-performance-negative';
}

export default function StockDetailsModal({
  stock,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}: StockDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>('1M');
  const {
    points: historyPoints,
    error: historyError,
    isLoading: isHistoryLoading,
    isRefreshing: isHistoryRefreshing,
    viewStatus: historyStatus,
  } = useStockHistory(stock.ticker, historyRange);

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
  const historyVariation = getHistoryPeriodVariation(historyPoints);
  const historyVariationClass = getHistoryVariationClass(historyVariation);

  const primaryDetailRows: StockDetailRow[] = [
    { label: 'Último precio', value: formatMoney(stock.price) },
    {
      label: 'Variación diaria',
      value: formatSignedPercent(stock.var),
      valueClassName: `stock-var ${varClass} ${strengthClass}`.trim(),
    },
    { label: 'Apertura', value: formatMoney(stock.open) },
    { label: 'Último cierre', value: formatMoney(stock.close) },
  ];

  const secondaryDetailRows: StockDetailRow[] = [
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
    { label: 'Mínimo', value: formatMoney(stock.min) },
    { label: 'Máximo', value: formatMoney(stock.max) },
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
          <div className="stock-details-heading">
            <StockFavoriteButton
              ticker={stock.ticker}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
              className="stock-details-favorite-button"
            />

            <div>
              <h2 id={titleId} className="stock-details-title">
                {stock.ticker}
              </h2>
              <p className="stock-details-description">{stock.description}</p>
            </div>
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

        <section className="stock-history-section" aria-label="Histórico">
          <div className="stock-history-header">
            <div className="stock-history-heading">
              <div>
                <h3 className="stock-history-title">Histórico</h3>
                <p className="stock-history-subtitle">
                  {HISTORY_RANGE_LABEL[historyRange]}
                </p>
              </div>

              {historyStatus === 'success' && historyVariation !== null && (
                <span
                  className={`stock-history-performance ${historyVariationClass}`}
                >
                  {formatSignedPercent(historyVariation)}
                </span>
              )}
            </div>

            <div className="stock-history-range-group" aria-label="Rango">
              {STOCK_HISTORY_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={
                    range === historyRange
                      ? 'stock-history-range-button stock-history-range-button-active'
                      : 'stock-history-range-button'
                  }
                  onClick={() => setHistoryRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {isHistoryLoading && (
            <div className="stock-history-state" role="status">
              Cargando histórico...
            </div>
          )}

          {historyStatus === 'error' && (
            <div className="stock-history-state stock-history-state-error" role="alert">
              {historyError?.message ?? 'No se pudo cargar el histórico.'}
            </div>
          )}

          {historyStatus === 'empty' && (
            <div className="stock-history-state">
              <strong>Sin histórico disponible</strong>
              <span>No hay datos históricos para este rango.</span>
            </div>
          )}

          {historyStatus === 'success' && (
            <div
              className={
                isHistoryRefreshing
                  ? 'stock-history-chart-wrap stock-history-chart-wrap-refreshing'
                  : 'stock-history-chart-wrap'
              }
            >
              <StockHistoryChart
                points={historyPoints}
                symbol={stock.ticker}
              />
            </div>
          )}
        </section>

        <dl className="stock-details-grid stock-details-grid-primary">
          {primaryDetailRows.map(({ label, value, className, valueClassName }) => (
            <div key={label} className={className}>
              <dt>{label}</dt>
              <dd className={valueClassName}>{value}</dd>
            </div>
          ))}
        </dl>

        <dl className="stock-details-grid stock-details-grid-secondary">
          {secondaryDetailRows.map(({ label, value, className, valueClassName }) => (
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
