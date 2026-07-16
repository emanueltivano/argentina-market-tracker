// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorPage from './error'
import GlobalErrorPage from './global-error'
import NotFoundPage, { metadata as notFoundMetadata } from './not-found'

describe('error pages', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the 404 in Spanish with one heading and navigation home', () => {
    const { container } = render(<NotFoundPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })
    ).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe(
      '/'
    )
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: false })
  })

  it('offers retry and home without exposing internal error details', () => {
    const reset = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { container } = render(
      <ErrorPage error={new Error('upstream token secret')} reset={reset} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }))

    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe(
      '/'
    )
    expect(container.textContent).not.toContain('upstream token secret')
    expect(container.textContent).not.toMatch(/Unexpected error|Retry|Something went wrong/)
    expect(consoleError).toHaveBeenCalled()
  })

  it('keeps the global fallback in Spanish and hides internal details', () => {
    const reset = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { container } = render(
      <GlobalErrorPage error={new Error('private provider detail')} reset={reset} />
    )

    expect(
      screen.getByRole('heading', { name: 'No pudimos mostrar la aplicación.' })
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe(
      '/'
    )
    expect(container.textContent).not.toContain('private provider detail')
    expect(container.textContent).not.toMatch(/Application error|Retry|could not render/)
  })
})
