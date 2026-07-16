import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { THEME_COOKIE_NAME, isTheme } from '@/lib/theme'
import {
  getAbsoluteSiteUrl,
  getPublicSiteUrl,
} from '@/lib/server/publicSiteUrl'
import './globals.css'

const siteUrl = getPublicSiteUrl()
const socialImageUrl = getAbsoluteSiteUrl('/og-image.png')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Argentina Market Tracker',
  title: {
    default: 'Argentina Market Tracker',
    template: '%s | Argentina Market Tracker',
  },
  description:
    'Dashboard full-stack production-oriented para mercado argentino, con demo pública estable, BFF interno e integración live configurable.',
  keywords: [
    'mercado argentino',
    'acciones argentinas',
    'Argentina market dashboard',
    'Next.js portfolio',
    'React',
    'TypeScript',
    'financial dashboard',
    'backend for frontend',
    'Playwright',
    'Vitest',
  ],
  authors: [{ name: 'Emanuel Tivano' }],
  creator: 'Emanuel Tivano',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Argentina Market Tracker',
    description:
      'Dashboard full-stack production-oriented con demo pública, BFF interno, contratos validados e integración live configurable.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'Argentina Market Tracker',
    url: siteUrl,
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: 'Argentina Market Tracker dashboard preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argentina Market Tracker',
    description:
      'Dashboard de mercado argentino con demo pública, BFF seguro, contratos validados, histórico y tests.',
    images: [socialImageUrl],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
  },
}

type RootLayoutProps = {
  children: ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies()
  const storedTheme = cookieStore.get(THEME_COOKIE_NAME)?.value
  const themeClassName = isTheme(storedTheme) ? storedTheme : undefined
  const colorScheme = storedTheme === 'dark' ? 'dark' : 'light'

  return (
    <html
      lang="es"
      className={themeClassName}
      style={{ colorScheme }}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
