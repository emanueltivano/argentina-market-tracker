import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_COOKIE_NAME } from '@/lib/theme'

const cookiesMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

describe('RootLayout', () => {
  afterEach(() => {
    cookiesMock.mockReset()
    vi.resetModules()
  })

  it('does not render an inline bootstrap script', async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    })

    const { default: RootLayout } = await import('./layout')
    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <main>dashboard</main>,
      })
    )

    expect(markup).not.toContain('<script')
    expect(markup).not.toContain('dangerouslySetInnerHTML')
  })

  it('applies the stored dark theme from cookies on the server render', async () => {
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === THEME_COOKIE_NAME ? { name, value: 'dark' } : undefined,
    })

    const { default: RootLayout } = await import('./layout')
    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <main>dashboard</main>,
      })
    )

    expect(markup).toContain('<html lang="es" class="dark" style="color-scheme:dark">')
  })
})
