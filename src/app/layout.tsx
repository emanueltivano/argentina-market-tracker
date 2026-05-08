import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Argentina Market Tracker',
  description: 'Paneles de mercado — InvertirOnline',
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
