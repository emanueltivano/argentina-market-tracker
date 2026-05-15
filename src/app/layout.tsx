import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Argentina Market Tracker',
    template: '%s | Argentina Market Tracker',
  },
  description:
    'Dashboard full-stack para acciones argentinas con Next.js, rutas API seguras, contratos validados, historiales, cache y tests automatizados.',
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
  openGraph: {
    title: 'Argentina Market Tracker',
    description:
      'Dashboard para mercado argentino construido con Next.js, TypeScript, SWR y Playwright.',
    type: 'website',
    locale: 'es_AR',
    images: [
      {
        url: '/og-image.svg',
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
      'Dashboard de mercado argentino con rutas API seguras, contratos validados, histórico y tests.',
    images: ['/og-image.svg'],
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var storedTheme = window.localStorage.getItem('argentina-market-tracker:theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : prefersDark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
} catch {}
            `.trim(),
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
