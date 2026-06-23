// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AboutPage from './page'

describe('AboutPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders concise project, data mode and disclaimer information in Spanish', () => {
    render(<AboutPage />)

    expect(
      screen.getByRole('heading', { name: 'Argentina Market Tracker' })
    ).not.toBeNull()
    expect(screen.getByText(/Modo demo activo/)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Resumen técnico' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Uso responsable' })).not.toBeNull()
    expect(screen.getByText(/No es un broker/)).not.toBeNull()
  })

  it('links back to the dashboard and to the public GitHub repository', () => {
    render(<AboutPage />)

    expect(
      screen.getByRole('link', { name: 'Volver al dashboard' }).getAttribute('href')
    ).toBe('/')

    const repositoryLink = screen.getByRole('link', {
      name: 'Ver repositorio en GitHub',
    })

    expect(repositoryLink.getAttribute('href')).toBe(
      'https://github.com/emanueltivano/argentina-market-tracker'
    )
    expect(repositoryLink.getAttribute('rel')).toBe('noreferrer')
  })
})
