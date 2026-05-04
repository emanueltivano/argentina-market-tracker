import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const allowedOrigins = [
  process.env.NODE_ENV !== 'production' && 'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_ORIGIN,
].filter(Boolean)

const securityHeaders = [
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
]

const nextConfig = {
  reactStrictMode: true,

  turbopack: {
    root: __dirname,
  },

  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
