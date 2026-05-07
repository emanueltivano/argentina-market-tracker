// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FAVORITE_STOCKS_STORAGE_KEY,
  useFavoriteStocks,
} from './useFavoriteStocks'

function FavoriteStocksHarness() {
  const { favorites, isFavorite, toggleFavorite } = useFavoriteStocks()

  return (
    <div>
      <p data-testid="favorites">{favorites.join(',')}</p>
      <p data-testid="ggal-favorite">{String(isFavorite('ggal'))}</p>
      <button type="button" onClick={() => toggleFavorite('ggal')}>
        Toggle GGAL
      </button>
      <button type="button" onClick={() => toggleFavorite(' alua ')}>
        Toggle ALUA
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
})
