import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotFoundPage() {
  return (
    <main className="about-page">
      <div className="about-shell">
        <section className="about-section" aria-labelledby="not-found-heading">
          <p className="about-eyebrow">404</p>
          <h1 id="not-found-heading">No encontramos esta página</h1>
          <p>
            La dirección solicitada no existe o dejó de estar disponible.
            Podés volver al dashboard para seguir explorando el mercado.
          </p>
          <div className="panel-actions">
            <Link className="panel-about-link" href="/">
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
