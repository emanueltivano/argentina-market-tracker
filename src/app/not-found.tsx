import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <main className="about-page">
      <div className="about-shell">
        <section className="about-section" aria-labelledby="not-found-heading">
          <p className="about-eyebrow">404</p>
          <h1 id="not-found-heading">Page not found</h1>
          <p>
            The requested page does not exist in this project. Return to the
            market dashboard.
          </p>
          <div className="panel-actions">
            <Link className="panel-about-link" href="/">
              Back to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
