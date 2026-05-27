import { NextResponse, type NextRequest } from 'next/server'

function buildContentSecurityPolicy({
  isProduction,
  nonce,
}: {
  isProduction: boolean
  nonce: string
}) {
  const scriptSrc = isProduction
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
  const connectSrc = isProduction
    ? ["'self'"]
    : ["'self'", 'ws:', 'wss:', 'http:', 'https:']

  const directives = [
    ["default-src", ["'self'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['script-src', scriptSrc],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connectSrc],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['frame-src', ["'none'"]],
    ...(isProduction ? [['upgrade-insecure-requests', []]] : []),
  ]

  return directives
    .map(([directive, sources]) =>
      sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive
    )
    .join('; ')
}

export function middleware(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production'
  const nonce = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isProduction,
    nonce,
  })

  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

export { buildContentSecurityPolicy }
