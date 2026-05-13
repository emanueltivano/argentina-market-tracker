import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Technical overview of Argentina Market Tracker: architecture, data contracts, caching, rate limiting, testing and tradeoffs.',
};

const architectureItems = [
  {
    title: 'Secure BFF',
    text: 'The browser never calls the external provider directly. Next API routes keep credentials and OAuth token handling on the server.',
  },
  {
    title: 'Validated contracts',
    text: 'External payloads are normalized before they reach React, so the UI renders typed, predictable market rows and history points.',
  },
  {
    title: 'Operational safeguards',
    text: 'Short in-memory cache, request deduplication, timeout, retry and rate limiting reduce pressure on the upstream API.',
  },
  {
    title: 'Portfolio-ready QA',
    text: 'Vitest covers contracts, hooks, API routes and UI behavior. Playwright covers the dashboard flow with mocked market data.',
  },
];

const tradeoffs = [
  'The cache and rate limit are in-memory by design, so they are per serverless instance and not globally shared.',
  'The app avoids CDN/browser caching for market data and keeps freshness controlled by the API layer.',
  'Historical prices are fetched on demand instead of stored in a database, which keeps the project deployable without paid infrastructure.',
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-shell">
        <header className="about-hero">
          <Link className="about-back-link" href="/">
            Back to dashboard
          </Link>
          <p className="about-eyebrow">Technical case study</p>
          <h1>Argentina Market Tracker</h1>
          <p>
            A fullstack market dashboard built to demonstrate production-minded
            frontend work: data contracts, secure server boundaries, resilient
            UI states and a testable architecture.
          </p>
        </header>

        <section className="about-section" aria-labelledby="why-heading">
          <h2 id="why-heading">Why It Exists</h2>
          <p>
            Financial dashboards are useful portfolio projects because they
            expose real product problems: protected APIs, changing external
            payloads, stale data, loading states, mobile density, formatting and
            trust. This project keeps those concerns visible instead of hiding
            them behind static mock data.
          </p>
        </section>

        <section className="about-section" aria-labelledby="architecture-heading">
          <h2 id="architecture-heading">Architecture</h2>
          <div className="about-grid">
            {architectureItems.map((item) => (
              <article key={item.title} className="about-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="data-heading">
          <h2 id="data-heading">Data Flow</h2>
          <ol className="about-steps">
            <li>React requests market panels through SWR.</li>
            <li>Next API routes validate the requested panel or symbol.</li>
            <li>The server-only IOL client obtains and refreshes OAuth tokens.</li>
            <li>Responses are normalized into stable TypeScript contracts.</li>
            <li>The dashboard renders loading, empty, error, stale and success states.</li>
          </ol>
        </section>

        <section className="about-section" aria-labelledby="tradeoffs-heading">
          <h2 id="tradeoffs-heading">Tradeoffs</h2>
          <ul className="about-list">
            {tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
