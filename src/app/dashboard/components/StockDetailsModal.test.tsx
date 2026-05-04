// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StockDetailsModal from './StockDetailsModal'
import { type StockData } from './Stock'

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

    expect(document.activeElement).toBe(closeButton)

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
})
