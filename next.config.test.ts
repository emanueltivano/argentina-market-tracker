import { describe, expect, it } from 'vitest'
import nextConfig, {
  buildSecurityHeaders,
} from './next.config.mjs'
import { buildContentSecurityPolicy } from './middleware'

describe('next security headers', () => {
  it('includes the static security headers in next headers()', async () => {
    const headers = await nextConfig.headers()
    const pageHeaders = headers[0]?.headers ?? []
    const nosniff = pageHeaders.find(
      (header) => header.key === 'X-Content-Type-Options'
    )

    expect(nosniff?.value).toBe('nosniff')
  })

  it('uses a nonce-based production script-src instead of unsafe-inline', () => {
    const csp = buildContentSecurityPolicy({
      isProduction: true,
      nonce: 'test-nonce',
    })
    const scriptSrcDirective = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src '))

    expect(scriptSrcDirective).toContain("'nonce-test-nonce'")
    expect(scriptSrcDirective).toContain("'strict-dynamic'")
    expect(scriptSrcDirective).not.toContain("'unsafe-inline'")
  })

  it('keeps development CSP more permissive for Next dev tooling', () => {
    const csp = buildContentSecurityPolicy({
      isProduction: false,
      nonce: 'unused-in-dev',
    })
    const scriptSrcDirective = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src '))

    expect(scriptSrcDirective).toContain("'unsafe-inline'")
    expect(scriptSrcDirective).toContain("'unsafe-eval'")
  })

  it('adds production security headers without a static CSP header', () => {
    const headers = buildSecurityHeaders({ isProduction: true })
    const csp = headers.find((header) => header.key === 'Content-Security-Policy')

    expect(csp).toBeUndefined()
    expect(headers.some((header) => header.key === 'Strict-Transport-Security')).toBe(true)
  })
})
