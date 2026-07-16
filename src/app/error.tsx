'use client'

import { useEffect } from 'react'
import Link from 'next/link'

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
          <p className="about-eyebrow">Error de carga</p>
          <h1 id="error-heading">No pudimos cargar esta página.</h1>
          <p>
            El problema puede ser temporal. Intentá nuevamente o volvé al
            inicio para continuar.
          </p>
          <div className="panel-actions">
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={() => reset()}
            >
              Intentar nuevamente
            </button>
            <Link className="ui-button ui-button-secondary" href="/">
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
