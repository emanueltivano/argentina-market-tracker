import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function buildSecurityHeaders({
  isProduction,
}) {
  return [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    ...(isProduction
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ]
      : []),
  ]
}

const isProduction = process.env.NODE_ENV === 'production'

const nextConfig = {
  reactStrictMode: true,

  turbopack: {
    root: __dirname,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({ isProduction }),
      },
    ]
  },
}

export default nextConfig
