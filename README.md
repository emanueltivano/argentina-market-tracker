# Argentina Market Tracker

[![CI](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-green)

Argentina Market Tracker is a portfolio dashboard for exploring Argentine
market panels, favorites, quote detail, and historical price charts. It is a
technical demo, not a broker, trading platform, real-time quote service, or
financial advice product.

The project exists to show how a modern Next.js app can be structured beyond
the visual layer: App Router SSR, an internal BFF, server-only upstream access,
validated contracts, cache/rate-limit behavior, lightweight observability, and
automated tests.

- **Demo:** [argentina-market-tracker.vercel.app](https://argentina-market-tracker.vercel.app)
- **Primary stack:** Next.js 16, React 19, TypeScript strict, Tailwind CSS 4,
  SWR, lightweight-charts
- **Verification:** ESLint, TypeScript, Vitest, Testing Library, Playwright,
  GitHub Actions
- **Safe public mode:** deterministic demo data, no upstream credentials needed
- **Optional live mode:** server-side external API integration for controlled
  review

![Argentina Market Tracker desktop dashboard](./docs/screenshots/desktop.png)

## What It Demonstrates

This project demonstrates:

- Next.js App Router with SSR initial data and client revalidation
- clear server/client boundaries; the browser never receives upstream secrets
- internal API routes used as a BFF for panel, favorites, quote, history,
  health, and metrics endpoints
- TypeScript contracts and normalization before data reaches UI components
- deterministic demo data for stable public review
- optional live market-data integration with OAuth, timeout, and retry handling
- process-local caching, stale fallback paths, refresh cooldowns, and rate
  limiting
- dashboard composition across panel tables, favorites, stock detail, and
  chart/history views
- focused unit, component, hook, route, SSR, and E2E coverage
- CI-ready validation through a single `npm run validate` entrypoint

## Features

- Market panel tabs for leaders, general panel, and CEDEARs
- SSR first paint for the initial dashboard data
- Client refresh with SWR polling and hidden-tab pause behavior
- Favorite symbols stored client-side and refreshed through `/api/favorites`
- Stock detail modal/page with current quote, session data, order-book depth,
  and historical chart
- Demo/live source indicator in the UI
- Health and debug metrics endpoints for lightweight operational visibility
- CSP/security headers, request IDs, and sanitized server logging

## Architecture

```txt
Browser
  Next.js page + client dashboard
        |
        | internal fetches only
        v
Next.js route handlers in src/app/api
  request validation
  contract normalization
  cache / rate-limit checks
  demo data or server-only live integration
        |
        v
src/lib/server
  upstream API client
  token/cache/rate-limit helpers
  observability
```

Important folders:

```txt
src/app
  App Router pages, route handlers, layout, global error boundaries.

src/features/dashboard
  Client-facing dashboard feature code.

src/features/dashboard/panel
  Main dashboard orchestration, panel state, refresh behavior, and toolbar UI.

src/features/dashboard/stocks
  Stock table rows, sorting, layout helpers, and ticker rendering.

src/features/dashboard/favorites
  Client favorite persistence and favorite quote refresh flow.

src/features/dashboard/stock-detail
  Stock detail modal/page, history hook, quote hook, current quote resolution,
  history/quote synchronization, and live-session candle handling.

src/features/dashboard/charts
  Chart components and historical data calculations.

src/features/dashboard/shared
  Shared client-side dashboard helpers and row models.

src/lib
  Shared contracts, validation, formatting, and normalized data types.

src/lib/server
  Server-only configuration, upstream integration, cache, rate limiting,
  observability, demo data, panel/history/favorites/quote services.

e2e
  Playwright dashboard and SSR boot coverage.

docs
  Runbook and screenshots.
```

`stock-detail` is separated from panel, favorites, charts, and shared utilities
because it has its own workflow: selecting or routing to a symbol, fetching
quote/history detail, resolving the best current quote, synchronizing it with
history data, and rendering a detail-focused UI. Keeping that code together
makes the dashboard panel easier to scan while keeping chart primitives and
shared row utilities reusable.

See [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) for a reviewer-focused
map of the codebase.

## Internal API Routes

- `GET /api/panel?type=lider|general|cedears`
- `GET /api/favorites?items=bCBA:ALUA,bCBA:AAPL`
- `GET /api/stocks/[symbol]/quote?market=bCBA`
- `GET /api/stocks/[symbol]/history?range=1W|1M|3M|6M|1Y&market=bCBA`
- `GET /api/health`
- `GET /api/debug/metrics`
- `GET /api/token` for localhost-only token debugging

The browser calls these internal routes instead of the external provider. Live
credentials, OAuth tokens, upstream payload handling, cache behavior, and rate
limiting stay on the server side.

## Demo And Live Modes

`MARKET_DATA_SOURCE=demo` uses deterministic data from
`src/lib/server/demo/demoMarketData.ts`. It is the recommended mode for public
portfolio review because it needs no secrets and produces stable behavior.

`MARKET_DATA_SOURCE=live` enables the server-only upstream integration. Use it
only with private credentials and the live-mode environment variables listed in
[.env.local.example](./.env.local.example). For public deployments, prefer demo
mode.

## Local Setup

Requirements:

- Node `>=24.15.0 <25`
- npm
- no database, Prisma setup, or seed command is required

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.local.example .env.local
```

PowerShell equivalent:

```powershell
Copy-Item -LiteralPath .env.local.example -Destination .env.local
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Use [.env.local.example](./.env.local.example) as the source of truth. Do not
commit real secrets.

Minimal local/demo setup:

| Variable | Required | Notes |
| --- | --- | --- |
| `MARKET_DATA_SOURCE` | No | Use `demo` for portfolio review; defaults to demo behavior. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public origin for metadata/Open Graph; local default can be `http://localhost:3000`. |
| `APP_VERSION` | No | Optional version string exposed by `/api/health`. |

Required only for live mode:

| Variable | Notes |
| --- | --- |
| `API_URL` | External API base URL. |
| `TOKEN_ENDPOINT` | Token endpoint path. |
| `API_USERNAME` | Upstream username. |
| `API_PASSWORD` | Upstream password. |
| `PANEL_LIDER_ENDPOINT` | Upstream leader panel endpoint. |
| `PANEL_GENERAL_ENDPOINT` | Upstream general panel endpoint. |
| `PANEL_CEDEARS_ENDPOINT` | Upstream CEDEARs endpoint. |

Operational/debug variables:

| Variable | Notes |
| --- | --- |
| `ENABLE_TOKEN_DEBUG` | Enables localhost-only token/raw panel debug routes outside production. |
| `OBSERVABILITY_DEBUG_TOKEN` | Required to read `/api/debug/metrics` in production when configured. |
| `FAVORITES_QUOTE_CONCURRENCY` | Bounds favorite quote fan-out; valid range is `1-10`. |
| `RATE_LIMIT_STORE` | `auto`, `memory`, or `redis-rest`. |
| `RATE_LIMIT_TRUSTED_PROXY` | `none` or `vercel`. |
| `RATE_LIMIT_REDIS_REST_URL` | REST-compatible Redis/KV URL for distributed rate limiting. |
| `RATE_LIMIT_REDIS_REST_TOKEN` | Token for the Redis/KV REST endpoint. |

## Scripts

```bash
npm run dev          # Next.js dev server on port 3000
npm run dev:e2e      # Next.js dev server on port 3100
npm run lint         # ESLint
npm run type-check   # TypeScript --noEmit
npm run test         # Vitest
npm run build        # Production build
npm run validate     # lint, type-check, test, build, then E2E suite
```

E2E commands:

```bash
npm run test:e2e
npm run test:e2e:ssr
npm run test:e2e:app
npm run test:e2e:ui
```

`npm run validate:local` runs lint, type-check, tests, and build without the
Playwright E2E suite. `npm run validate` is closest to CI.

## Testing Strategy

The test suite covers:

- shared data contracts and normalization
- route handlers and error contracts
- cache, rate-limit, and stale fallback behavior
- dashboard hooks and UI states
- favorites behavior and quote refresh
- stock detail quote/history logic
- chart data calculations
- SSR boot behavior and interactive dashboard flows with Playwright

GitHub Actions runs the validation flow in demo mode through
[.github/workflows/ci.yml](./.github/workflows/ci.yml).

## Screenshots

Existing screenshots:

- [Desktop dashboard](./docs/screenshots/desktop.png)
- [Stock detail history](./docs/screenshots/modal-history.png)
- [Mobile dashboard](./docs/screenshots/mobile.png)

![Argentina Market Tracker modal history](./docs/screenshots/modal-history.png)

## Operational Notes

See [docs/RUNBOOK.md](./docs/RUNBOOK.md) for health checks, request ID
correlation, debug metrics, degraded health interpretation, rate-limit failure
modes, and demo/live troubleshooting.

Important constraints:

- demo mode is synthetic and not real market data
- live mode depends on a third-party upstream provider
- panel, history, favorites quote cache, in-flight dedupe, stale fallback, and
  metrics are process-local unless distributed storage is configured where
  supported
- `/api/favorites` performs bounded fan-out to individual quote lookups; there
  is no real upstream batch quote endpoint in this project
- the project is designed as a technical portfolio demo, not as a live trading
  or financial decision-making tool
