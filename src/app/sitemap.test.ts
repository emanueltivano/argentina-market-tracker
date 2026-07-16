import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sitemap from './sitemap'

const OLD_ENV = { ...process.env }

describe('sitemap', () => {
  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://market.example.com/',
    }
  })

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('contains only stable, absolute public routes', () => {
    const entries = sitemap()

    expect(entries).toEqual([
      expect.objectContaining({ url: 'https://market.example.com/' }),
      expect.objectContaining({ url: 'https://market.example.com/about' }),
    ])
    expect(entries.every((entry) => URL.canParse(entry.url))).toBe(true)
  })

  it('does not expose API, debug, internal, or invented asset routes', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls.some((url) => url.includes('/api'))).toBe(false)
    expect(urls.some((url) => url.includes('/debug'))).toBe(false)
    expect(urls.some((url) => url.includes('/health'))).toBe(false)
    expect(urls.some((url) => url.includes('/stocks/'))).toBe(false)
  })

  it('does not manufacture last-modified timestamps', () => {
    expect(sitemap().every((entry) => entry.lastModified === undefined)).toBe(
      true
    )
  })
})
