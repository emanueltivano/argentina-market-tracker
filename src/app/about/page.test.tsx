// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AboutPage from './page'

const REPOSITORY_URL =
  'https://github.com/emanuel-tivano/argentina-market-tracker'

describe('AboutPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('presents Emanuel Tivano and the project value first', () => {
    render(<AboutPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Emanuel Tivano' })
    ).not.toBeNull()
    expect(screen.getByText(/pieza de portfolio full-stack/i)).not.toBeNull()
    expect(screen.getByText(/renderizado server-side/i)).not.toBeNull()
    expect(screen.getByText(/Modo demo activo/)).not.toBeNull()
  })

  it('explains the problem, author responsibilities, decisions, and stack', () => {
    render(<AboutPage />)

    expect(
      screen.getByRole('heading', { name: 'Problema resuelto' })
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Mi aporte y responsabilidades' })
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Decisiones técnicas destacadas' })
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Stack tecnológico' })
    ).not.toBeNull()
    expect(screen.getByText(/Next.js 16, React 19/)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'BFF interno' })).not.toBeNull()
  })

  it('uses the correct repository and secure external-link attributes', () => {
    render(<AboutPage />)

    const repositoryLinks = screen.getAllByRole('link', {
      name: /GitHub|Repositorio de Argentina Market Tracker/,
    })

    expect(repositoryLinks).toHaveLength(2)
    for (const link of repositoryLinks) {
      expect(link.getAttribute('href')).toBe(REPOSITORY_URL)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('does not render unconfigured contact channels or broken links', () => {
    const { container } = render(<AboutPage />)

    expect(screen.queryByText('[Agregar LinkedIn]')).toBeNull()
    expect(screen.queryByText('[Agregar correo profesional]')).toBeNull()
    expect(
      screen.getByText(/LinkedIn y correo profesional todavía no están publicados/i)
    ).not.toBeNull()
    expect(container.querySelector('a[href=""]')).toBeNull()
    expect(container.querySelector('a[href="#"]')).toBeNull()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(container.innerHTML).not.toContain('emanueltivano')
  })

  it('keeps a single h1 and a valid basic heading hierarchy', () => {
    const { container } = render(<AboutPage />)
    const headings = [...container.querySelectorAll('h1, h2, h3')]
    const levels = headings.map((heading) => Number(heading.tagName.slice(1)))

    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(levels[0]).toBe(1)
    expect(
      levels.every((level, index) => index === 0 || level - levels[index - 1] <= 1)
    ).toBe(true)
  })
})
