// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StockDetailsModal from '@/features/dashboard/history/StockDetailsModal'
import { type StockData } from '@/features/dashboard/shared/stockData'

vi.mock('@/features/dashboard/history/useStockHistory', () => ({
  useStockHistory: () => ({
    points: [],
    error: undefined,
    isLoading: false,
    isRefreshing: false,
    viewStatus: 'empty',
  }),
}))

const stock: StockData = {
  ticker: 'GGAL',
  description: 'Grupo Financiero Galicia',
  price: 100,
  var: 1.5,
  varType: 'positive',
  buyQty: 10,
  buyPrice: 99,
  sellPrice: 101,
  sellQty: 20,
  open: 98,
  min: 97,
  max: 102,
  close: 99,
  volume: 1000,
}

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir
      </button>
      {isOpen && (
        <StockDetailsModal stock={stock} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}

describe('StockDetailsModal', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
      this: HTMLDialogElement
    ) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn(function close(
      this: HTMLDialogElement
    ) {
      this.removeAttribute('open')
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens with focus on the close button and restores focus to the opener', async () => {
    render(<ModalHarness />)

    const opener = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(opener)

    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle' })
    const dialog = screen.getByRole('dialog', { name: 'GGAL' })

    expect(document.activeElement).toBe(closeButton)
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()

    await userEvent.click(closeButton)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('closes when the native dialog cancel event fires', async () => {
    render(<ModalHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes when the backdrop is clicked', async () => {
    render(<ModalHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    fireEvent.click(screen.getByRole('dialog'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the history empty state in the stock detail', async () => {
    render(<ModalHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))

    expect(
      screen.getByRole('button', { name: '1M' }).getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: '1W' }).getAttribute('aria-pressed')
    ).toBe('false')
    expect(
      screen.getByText('No hay datos históricos para este rango.')
    ).not.toBeNull()
  })

  it('shows the nominal volume from the selected panel stock', async () => {
    render(<ModalHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))

    const volumeValue = screen.getByText('Volumen nominal').nextElementSibling

    expect(volumeValue?.textContent).toBe('1.000')
  })

  it('shows the metric fallback when nominal volume is unavailable', async () => {
    render(
      <StockDetailsModal
        stock={{ ...stock, volume: null }}
        onClose={() => undefined}
      />
    )

    const volumeValue = screen.getByText('Volumen nominal').nextElementSibling

    expect(volumeValue?.textContent).toBe('—')
  })

  it('shows a full page action for the selected stock', async () => {
    render(<ModalHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))

    const link = screen.getByRole('link', {
      name: 'Ver página completa de GGAL',
    })
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle' })
    const favoriteButton = screen.getByRole('button', {
      name: 'Agregar GGAL a favoritos',
    })

    expect(link.getAttribute('href')).toBe('/stocks/GGAL')
    expect(link.classList.contains('ui-icon-button')).toBe(true)
    expect(link.classList.contains('stock-detail-icon-button')).toBe(true)
    expect(link.classList.contains('stock-details-action')).toBe(true)
    expect(link.classList.contains('ui-icon-button-raised')).toBe(false)
    expect(closeButton.classList.contains('ui-icon-button')).toBe(true)
    expect(closeButton.classList.contains('stock-detail-icon-button')).toBe(
      true
    )
    expect(closeButton.classList.contains('stock-details-action')).toBe(true)
    expect(closeButton.classList.contains('ui-icon-button-raised')).toBe(false)
    expect(favoriteButton.classList.contains('stock-detail-icon-button')).toBe(
      true
    )
  })
})
