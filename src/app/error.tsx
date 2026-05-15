'use client'

import { useEffect } from 'react'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[app.error]', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <main className="about-page">
      <div className="about-shell">
        <section className="about-section" aria-labelledby="error-heading">
          <p className="about-eyebrow">Unexpected error</p>
          <h1 id="error-heading">Something went wrong loading the dashboard.</h1>
          <p>
            The app hid internal error details, but the page can be retried
            safely.
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
    </main>
  )
}
