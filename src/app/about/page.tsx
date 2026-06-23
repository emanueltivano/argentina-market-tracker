import type { Metadata } from 'next';
import Link from 'next/link';
import { ENV } from '@/lib/server/env';

export const metadata: Metadata = {
  title: 'Datos y proyecto',
  description:
    'Información sobre los datos, el objetivo y la arquitectura de Argentina Market Tracker.',
};

const architectureItems = [
  {
    title: 'BFF seguro',
    text: 'El navegador consume rutas internas de Next.js. Las credenciales y la integración con el proveedor externo permanecen en el servidor.',
  },
  {
    title: 'Contratos validados',
    text: 'Los payloads externos se validan y normalizan antes de llegar a React para mantener datos tipados y estados predecibles.',
  },
  {
    title: 'Resiliencia',
    text: 'Caché de corta duración, deduplicación, timeouts, reintentos y rate limiting reducen presión sobre el servicio externo.',
  },
  {
    title: 'Verificación',
    text: 'Vitest cubre contratos, hooks, rutas y componentes. Playwright verifica los flujos principales y el arranque con SSR.',
  },
];

const tradeoffs = [
  'La caché y el rate limiting pueden operar en memoria y, en ese caso, son locales a cada instancia.',
  'Los precios históricos se consultan bajo demanda y no se almacenan en una base de datos propia.',
  'El modo demo prioriza una revisión pública estable; el modo live depende de la disponibilidad del proveedor externo.',
];

export default function AboutPage() {
  const isDemoMode = ENV.MARKET_DATA_SOURCE === 'demo';
  const modeLabel = isDemoMode ? 'Modo demo activo' : 'Modo live activo';

  return (
    <main className="about-page">
      <div className="about-shell">
        <header className="about-hero">
          <Link className="about-back-link" href="/">
            Volver al dashboard
          </Link>
          <p className="about-eyebrow">Datos y proyecto</p>
          <h1>Argentina Market Tracker</h1>
          <p>
            Dashboard de mercado argentino creado como proyecto de portfolio para
            mostrar una arquitectura full-stack con límites seguros, datos
            validados y estados de interfaz resilientes.
          </p>
          <p className="about-mode-note">
            <strong>{modeLabel}.</strong>{' '}
            {isDemoMode
              ? 'El dashboard usa datos determinísticos de muestra, no cotizaciones en tiempo real.'
              : 'El dashboard obtiene datos del proveedor de mercado configurado mediante el BFF interno.'}
          </p>
        </header>

        <section className="about-section" aria-labelledby="scope-heading">
          <h2 id="scope-heading">Qué muestra</h2>
          <p>
            Permite explorar paneles de acciones argentinas y CEDEARs, administrar
            favoritos, ordenar cotizaciones y consultar el detalle e histórico de
            cada activo. En modo live, los datos provienen de la integración de
            mercado configurada en el servidor; el browser nunca accede al
            proveedor directamente.
          </p>
        </section>

        <section className="about-section" aria-labelledby="architecture-heading">
          <h2 id="architecture-heading">Resumen técnico</h2>
          <div className="about-grid">
            {architectureItems.map((item) => (
              <article key={item.title} className="about-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="tradeoffs-heading">
          <h2 id="tradeoffs-heading">Alcance y decisiones</h2>
          <ul className="about-list">
            {tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            ))}
          </ul>
        </section>

        <section className="about-section" aria-labelledby="disclaimer-heading">
          <h2 id="disclaimer-heading">Uso responsable</h2>
          <p>
            Este sitio es una demostración técnica. No es un broker, una plataforma
            de trading ni ofrece asesoramiento financiero. La información puede
            estar demorada, ser sintética o contener limitaciones propias de la
            fuente configurada.
          </p>
          <a
            className="ui-button ui-button-secondary about-repository-link"
            href="https://github.com/emanueltivano/argentina-market-tracker"
            target="_blank"
            rel="noreferrer"
          >
            Ver repositorio en GitHub
          </a>
        </section>
      </div>
    </main>
  );
}
