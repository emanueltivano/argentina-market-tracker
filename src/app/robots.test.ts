import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import robots from './robots'

const OLD_ENV = { ...process.env }

describe('robots', () => {
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

  it('allows public pages and references the absolute sitemap', () => {
    expect(robots()).toMatchObject({
      rules: {
        userAgent: '*',
        allow: '/',
      },
      host: 'https://market.example.com',
      sitemap: 'https://market.example.com/sitemap.xml',
    })
  })

  it('blocks every API-backed internal route with one prefix rule', () => {
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const disallowed = rules.flatMap((rule) => rule.disallow ?? [])

    expect(disallowed).toContain('/api/')
    expect('/api/debug/metrics'.startsWith('/api/')).toBe(true)
    expect('/api/health'.startsWith('/api/')).toBe(true)
    expect('/api/token'.startsWith('/api/')).toBe(true)
  })
})
