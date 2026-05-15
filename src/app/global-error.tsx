'use client'

import { useEffect } from 'react'

type GlobalErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  useEffect(() => {
    console.error('[app.global-error]', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <html lang="es">
      <body className="about-page">
        <div className="about-shell">
          <section className="about-section" aria-labelledby="global-error-heading">
            <p className="about-eyebrow">Application error</p>
            <h1 id="global-error-heading">The application could not render.</h1>
            <p>
              Try loading the dashboard again. Sensitive internal details remain
              hidden from this screen.
            </p>
            <div className="panel-actions">
              <button
                type="button"
                className="theme-toggle-button"
                onClick={() => reset()}
              >
                Retry
              </button>
            </div>
          </section>
        </div>
      </body>
    </html>
  )
}
