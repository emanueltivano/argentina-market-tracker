import { useCallback, useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import { type MarketPanelKey } from '@/lib/market'
import { type StockData } from '../lib/stockData'
import StockFavoriteButton from './StockFavoriteButton'
import { getMarketPanelOption } from '../lib/marketPanelOptions'
import StockDetailsContent from './StockDetailsContent'

type StockDetailsModalProps = {
  stock: StockData
  onClose: () => void
  isFavorite?: boolean
  onToggleFavorite?: (stock: StockData) => void
  panelKey?: MarketPanelKey
}

export default function StockDetailsModal({
  stock,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  panelKey,
}: StockDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const activeElement = document.activeElement

    if (!dialog) {
      return
    }

    openerRef.current =
      activeElement instanceof HTMLElement ? activeElement : null

    if (!dialog.open) {
      dialog.showModal()
    }

    closeButtonRef.current?.focus()

    return () => {
      if (dialog.open) {
        dialog.close()
      }

      if (openerRef.current?.isConnected) {
        openerRef.current.focus()
      }
    }
  }, [])

  const panelLabel = panelKey ? getMarketPanelOption(panelKey).label : null
  const stockPageHref = `/stocks/${encodeURIComponent(stock.ticker)}`
  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(stock)
  }, [onToggleFavorite, stock])

  return (
    <dialog
      ref={dialogRef}
      className="stock-details-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="stock-details-modal">
        <header className="stock-details-header">
          <div className="stock-details-heading">
            <StockFavoriteButton
              ticker={stock.ticker}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              className="stock-details-favorite-button"
            />

            <div>
              <div className="stock-details-title-row">
                <h2 id={titleId} className="stock-details-title">
                  {stock.ticker}
                </h2>
                {panelLabel && (
                  <span className="ui-pill ui-pill-muted stock-details-panel-label">
                    {panelLabel}
                  </span>
                )}
              </div>
              <p id={descriptionId} className="stock-details-description">
                {stock.description}
              </p>
            </div>
          </div>

          <div className="stock-details-actions">
            <Link
              href={stockPageHref}
              className="ui-icon-button ui-icon-button-raised stock-details-action stock-details-expand"
              aria-label={`Ver página completa de ${stock.ticker}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
                <path d="M4 16v2a2 2 0 0 0 2 2h2" />
                <path d="M16 4h2a2 2 0 0 1 2 2v2" />
                <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
              </svg>
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              className="ui-icon-button ui-icon-button-raised stock-details-action stock-details-close"
              onClick={onClose}
              aria-label="Cerrar detalle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M18 6l-12 12" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <StockDetailsContent stock={stock} />
      </div>
    </dialog>
  )
}
