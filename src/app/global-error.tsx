'use client'

import { useEffect } from 'react'
import Link from 'next/link'

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
            <p className="about-eyebrow">Error de la aplicación</p>
            <h1 id="global-error-heading">No pudimos mostrar la aplicación.</h1>
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
      </body>
    </html>
  )
}
