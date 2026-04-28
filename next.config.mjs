import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const allowedOrigins = [
  process.env.NODE_ENV !== 'production' && 'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_ORIGIN,
].filter(Boolean)

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
}

export default nextConfig