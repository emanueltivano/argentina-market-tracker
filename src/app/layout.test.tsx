import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_COOKIE_NAME } from '@/lib/theme'

const cookiesMock = vi.fn()
const OLD_ENV = { ...process.env }

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

describe('RootLayout', () => {
  afterEach(() => {
    cookiesMock.mockReset()
    vi.resetModules()
    process.env = { ...OLD_ENV }
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

  it('uses the configured public origin in global metadata', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://market.example.com/',
    }

    const { metadata } = await import('./layout')

    expect(metadata).toMatchObject({
      metadataBase: new URL('https://market.example.com'),
      applicationName: 'Argentina Market Tracker',
      alternates: { canonical: '/' },
      openGraph: {
        siteName: 'Argentina Market Tracker',
        url: 'https://market.example.com',
        images: [
          expect.objectContaining({
            url: 'https://market.example.com/og-image.png',
            width: 1200,
            height: 630,
          }),
        ],
      },
      twitter: {
        images: ['https://market.example.com/og-image.png'],
      },
    })
  })

  it('references an existing raster Open Graph image', async () => {
    const { metadata } = await import('./layout')

    expect(
      existsSync(path.join(process.cwd(), 'public', 'og-image.png'))
    ).toBe(true)
    expect(JSON.stringify(metadata.openGraph)).toContain('/og-image.png')
  })
})
