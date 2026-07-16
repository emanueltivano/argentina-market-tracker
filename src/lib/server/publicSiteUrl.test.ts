import { afterEach, describe, expect, it } from 'vitest'
import { getAbsoluteSiteUrl, getPublicSiteUrl } from './publicSiteUrl'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('publicSiteUrl', () => {
  it('uses and normalizes an explicit public URL', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://market.example.com/',
    }

    expect(getPublicSiteUrl()).toBe('https://market.example.com')
    expect(getAbsoluteSiteUrl('/about')).toBe(
      'https://market.example.com/about'
    )
  })

  it('rejects malformed, non-origin, and insecure production URLs', () => {
    const production = { NODE_ENV: 'production' as const }

    expect(() =>
      getPublicSiteUrl({
        ...production,
        NEXT_PUBLIC_SITE_URL: 'not-a-url',
      })
    ).toThrow('valid absolute URL')
    expect(() =>
      getPublicSiteUrl({
        ...production,
        NEXT_PUBLIC_SITE_URL: 'https://example.com/app',
      })
    ).toThrow('only the public origin')
    expect(() =>
      getPublicSiteUrl({
        ...production,
        NEXT_PUBLIC_SITE_URL: 'http://example.com',
      })
    ).toThrow('must use https in production')
  })

  it('allows a loopback HTTP origin for production-mode local builds', () => {
    expect(
      getPublicSiteUrl({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100/',
      })
    ).toBe('http://127.0.0.1:3100')
  })

  it('uses Vercel production before preview URLs', () => {
    expect(
      getPublicSiteUrl({
        NODE_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'market.example.com',
        VERCEL_URL: 'preview.vercel.app',
      })
    ).toBe('https://market.example.com')
  })

  it('falls back to localhost only outside production', () => {
    expect(getPublicSiteUrl({ NODE_ENV: 'development' })).toBe(
      'http://localhost:3000'
    )
    expect(() => getPublicSiteUrl({ NODE_ENV: 'production' })).toThrow(
      'A public site URL is required in production'
    )
  })
})
