// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY,
  FAVORITE_STOCKS_STORAGE_KEY,
  useFavoriteStocks,
} from './useFavoriteStocks'

function FavoriteStocksHarness() {
  const {
    addFavoriteSnapshot,
    favoriteSnapshotsByTicker,
    favorites,
    isFavorite,
    removeFavoriteSnapshot,
    toggleFavorite,
  } = useFavoriteStocks()

  return (
    <div>
      <p data-testid="favorites">{favorites.join(',')}</p>
      <p data-testid="snapshots">
        {Object.keys(favoriteSnapshotsByTicker).join(',')}
      </p>
      <p data-testid="ggal-favorite">{String(isFavorite('ggal'))}</p>
      <button type="button" onClick={() => toggleFavorite('ggal')}>
        Toggle GGAL
      </button>
      <button type="button" onClick={() => toggleFavorite(' alua ')}>
        Toggle ALUA
      </button>
      <button
        type="button"
        onClick={() =>
          addFavoriteSnapshot({
            ticker: ' bma ',
            description: 'Banco Macro',
            price: 120,
            var: 1.5,
            varType: 'positive',
            buyQty: null,
            buyPrice: null,
            sellPrice: null,
            sellQty: null,
            open: 100,
            min: 95,
            max: 125,
            close: 118,
            volume: 1000,
          })
        }
      >
        Add BMA snapshot
      </button>
      <button type="button" onClick={() => removeFavoriteSnapshot('bma')}>
        Remove BMA snapshot
      </button>
    </div>
  )
}

describe('useFavoriteStocks', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('toggles favorites and persists them in localStorage', async () => {
    render(<FavoriteStocksHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Toggle GGAL' }))

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe('GGAL')
    })
    expect(screen.getByTestId('ggal-favorite').textContent).toBe('true')
    expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
      '["GGAL"]'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Toggle GGAL' }))

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe('')
    })
    expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe('[]')
  })

  it('loads, normalizes, sorts and deduplicates stored favorites', async () => {
    window.localStorage.setItem(
      FAVORITE_STOCKS_STORAGE_KEY,
      JSON.stringify(['ypfd', 'GGAL', 'ggal', ' alua ', ''])
    )

    render(<FavoriteStocksHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe(
        'ALUA,GGAL,YPFD'
      )
    })
    expect(window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY)).toBe(
      '["ALUA","GGAL","YPFD"]'
    )
  })

  it('falls back to empty favorites when stored JSON is invalid', async () => {
    window.localStorage.setItem(FAVORITE_STOCKS_STORAGE_KEY, '{broken-json')

    render(<FavoriteStocksHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe('')
    })
    expect(screen.getByTestId('ggal-favorite').textContent).toBe('false')
  })

  it('falls back to empty favorites when localStorage.getItem throws', async () => {
    const getItemMock = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage blocked')
      })

    render(<FavoriteStocksHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe('')
    })
    expect(screen.getByTestId('snapshots').textContent).toBe('')
    expect(getItemMock).toHaveBeenCalled()
  })

  it('persists and hydrates normalized favorite snapshots', async () => {
    render(<FavoriteStocksHarness />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Add BMA snapshot' })
    )

    await waitFor(() => {
      expect(screen.getByTestId('snapshots').textContent).toBe('BMA')
    })
    expect(
      JSON.parse(
        window.localStorage.getItem(FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY) ?? '{}'
      )
    ).toMatchObject({
      BMA: {
        ticker: 'BMA',
        description: 'Banco Macro',
        price: 120,
        volume: 1000,
      },
    })

    cleanup()

    render(<FavoriteStocksHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('snapshots').textContent).toBe('BMA')
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove BMA snapshot' })
    )

    await waitFor(() => {
      expect(screen.getByTestId('snapshots').textContent).toBe('')
    })
    expect(window.localStorage.getItem(FAVORITE_STOCK_SNAPSHOTS_STORAGE_KEY)).toBe(
      '{}'
    )
  })

  it('keeps toggle behavior working when localStorage.setItem throws', async () => {
    const setItemMock = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })

    render(<FavoriteStocksHarness />)

    await userEvent.click(screen.getByRole('button', { name: 'Toggle GGAL' }))

    await waitFor(() => {
      expect(screen.getByTestId('favorites').textContent).toBe('GGAL')
    })
    expect(screen.getByTestId('ggal-favorite').textContent).toBe('true')
    expect(setItemMock).toHaveBeenCalled()
  })

  it('keeps snapshot updates stable when storage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    render(<FavoriteStocksHarness />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Add BMA snapshot' })
    )

    await waitFor(() => {
      expect(screen.getByTestId('snapshots').textContent).toBe('BMA')
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove BMA snapshot' })
    )

    await waitFor(() => {
      expect(screen.getByTestId('snapshots').textContent).toBe('')
    })
  })
})
