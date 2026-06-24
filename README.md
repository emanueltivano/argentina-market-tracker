# Argentina Market Tracker

[![CI](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-green)

Production-oriented portfolio dashboard for Argentine equities built with
Next.js, React, and TypeScript.

This repo is intentionally a technical demo, not a broker, trading platform,
or financial advisory product. The goal is to show a pragmatic BFF-style
Next.js architecture with validated upstream contracts, SSR bootstrapping,
resilient client refresh, safer defaults for public demo deploys, and
meaningful automated verification.

## Overview

The browser talks only to internal routes such as:

- `/api/panel?type=lider|general|cedears`
- `/api/favorites?items=bCBA:ALUA,bCBA:AAPL`
- `/api/stocks/[symbol]/history?range=...&market=bCBA`
- `/api/health`
- `/api/debug/metrics`

Those routes handle:

- request validation
- upstream normalization
- rate limiting and refresh cooldowns
- fail-closed `503` JSON responses when the rate-limit backend is unavailable
- favorites fan-out to per-symbol upstream quotes
- process-local cache and stale fallback behavior
- structured logging and request ID correlation
- safe demo/live data-source switching

## Demo vs Live

Two server-side modes are supported:

- `demo`: deterministic fixture data, no upstream credentials required, safest
  choice for public portfolio deploys
- `live`: real upstream market API through the internal BFF, intended for
  controlled/private review of the integration

Recommendation:

- public portfolio deploy: `MARKET_DATA_SOURCE=demo`
- live integration review: `MARKET_DATA_SOURCE=live` plus distributed
  rate-limit storage and trusted proxy configuration

The UI shows a `Demo data` badge in demo mode, and `/api/health` reports the
active `dataSource`.

## Architecture

```txt
Browser
  App Router page + client dashboard
        |
        | GET /api/panel?type=...
        | GET /api/stocks/[symbol]/history?range=...
        v
Next.js Route Handlers
  Validation
  Contract normalization
  Rate limiting / cooldowns
  Demo fixtures or live upstream integration
        |
        v
Server-only market data layer
  Demo dataset
  or
  External API client with OAuth, timeout and retry protections
```

Important structure:

```txt
src/
  app/
    api/
    stocks/
  features/
    dashboard/
  lib/
    server/
e2e/
docs/
```

## Local Setup

Requirements:

- Node `24.15.0` recommended
- Node `>=24.15.0 <25` supported by the repo `engines`

Install:

```bash
npm install
cp .env.local.example .env.local
```

Run locally:

```bash
npm run dev
```

Useful scripts:

- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`
- `npm run validate`
- `npm run test:e2e`
- `npm run test:e2e:ssr`
- `npm run test:e2e:app`

`npm run validate` is the closest "reviewer command": static checks, unit and
component tests, production build, SSR E2E, and dashboard E2E.

## Environment Variables

Use [.env.local.example](./.env.local.example)
as the source of truth.

| Variable | Required | Description |
| --- | --- | --- |
| `MARKET_DATA_SOURCE` | No | `demo` or `live`; defaults to `demo` |
| `API_URL` | Live mode only | External API base URL, no trailing slash |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public origin for metadata/Open Graph |
| `TOKEN_ENDPOINT` | Live mode only | Token endpoint path; defaults to `token` |
| `API_USERNAME` | Live mode only | Upstream API username |
| `API_PASSWORD` | Live mode only | Upstream API password |
| `PANEL_LIDER_ENDPOINT` | Live mode only | Upstream endpoint for leader panel |
| `PANEL_GENERAL_ENDPOINT` | Live mode only | Upstream endpoint for general panel |
| `PANEL_CEDEARS_ENDPOINT` | Live mode only | Upstream endpoint for CEDEARs |
| `ENABLE_TOKEN_DEBUG` | No | Localhost-only debug switch for `/api/token` and `/api/panel?raw=1` |
| `APP_VERSION` | No | Optional deploy/version string exposed by `/api/health` |
| `OBSERVABILITY_DEBUG_TOKEN` | No | Enables `/api/debug/metrics` in production and becomes the required `x-observability-token` |
| `RATE_LIMIT_STORE` | No | `auto`, `memory`, or `redis-rest` |
| `RATE_LIMIT_TRUSTED_PROXY` | No | `none` or `vercel` |
| `RATE_LIMIT_REDIS_REST_URL` | No | Upstash Redis / Vercel KV REST-compatible URL |
| `RATE_LIMIT_REDIS_REST_TOKEN` | No | Token for the Redis/KV REST endpoint |

## Production Strategy

This project is best described as production-oriented, not "production-ready
for every workload". It includes meaningful hardening and operational docs, but
it still has honest scope limits.

### Public Portfolio Deploy

Recommended defaults:

- `MARKET_DATA_SOURCE=demo`
- no live credentials
- keep CSP, request IDs, health, and metrics support enabled
- optionally set `APP_VERSION` from CI/CD or the hosting platform

This is the safest Vercel posture for a recruiter-facing deployment.

### Live Integration Deploy

Recommended minimum:

- `MARKET_DATA_SOURCE=live`
- valid upstream credentials and panel endpoints
- `RATE_LIMIT_STORE=redis-rest`
- `RATE_LIMIT_REDIS_REST_URL`
- `RATE_LIMIT_REDIS_REST_TOKEN`
- `RATE_LIMIT_TRUSTED_PROXY=vercel` on Vercel
- `OBSERVABILITY_DEBUG_TOKEN` for protected debug metrics access
- `APP_VERSION` for easier operational identification

Recommendations:

- do not run public live mode without distributed rate-limit storage
- do not trust forwarded IPs unless the deployment boundary is known and owned
- do not share `OBSERVABILITY_DEBUG_TOKEN`
- do not expose live credentials in screenshots, logs, issues, or preview demos
- if the rate limiter is unavailable, the API fails closed with controlled `503`
  JSON responses to protect the upstream and preserve the route contract

### CI

GitHub Actions runs `npm run validate` on push and PR in demo mode via
[ci.yml](./.github/workflows/ci.yml), using Node `24.15.0` and the same
single `npm run validate` entrypoint that covers lint, type-check, Vitest,
build, SSR E2E, and dashboard E2E.

## Security

Current hardening includes:

- browser never talks directly to the external market provider
- OAuth token handling stays server-side
- validated and normalized panel/history contracts before rendering
- validated favorites identity input before per-symbol quote fan-out
- stricter production CSP with per-request nonce support
- request ID propagation via `X-Request-Id`
- structured log sanitization for secrets and auth material
- local-only debug routes for raw token/panel inspection

## Resilience

Current resilience mechanisms include:

- SSR first paint plus client revalidation
- panel cache with manual refresh bypass
- short-lived per-symbol favorites quote cache plus in-flight dedupe
- limited-concurrency favorites fan-out to avoid unbounded cold-cache upstream bursts
- hidden-tab polling pause and resume behavior
- history normalization that discards invalid points when possible
- stale history fallback from local cache when live upstream fails
- route-level rate limiting and panel refresh cooldown

## Observability

Built-in observability is intentionally lightweight:

- structured server logs
- `X-Request-Id` correlation
- `GET /api/health`
- `GET /api/debug/metrics`
- process-local counters and timing summaries

Metrics currently cover:

- request totals by endpoint/status/outcome
- request durations
- cache hits/misses/writes/stale hits
- rate-limit allowed/blocked decisions
- upstream request outcomes
- favorites quote fan-out and deduplicated symbol fetches
- discarded history points and stale fallback usage
- demo vs live response source

Health and metrics are documented operationally in
[docs/RUNBOOK.md](./docs/RUNBOOK.md).

Rate-limit failure mode:

- `/api/panel`, `/api/favorites`, and `/api/stocks/[symbol]/history` never
  return an uncaught HTML/500 response because of rate-limit store failures
- if Redis/KV config is invalid or the backend cannot be reached, those routes
  return:

```json
{
  "ok": false,
  "error": "RATE_LIMIT_UNAVAILABLE",
  "requestId": "..."
}
```

- the response includes `X-Request-Id` and a short `Retry-After`
- `/api/health` reports `status: "degraded"` when rate limiting falls back to
  process-local memory/shared identity in live or production-like mode, or when
  the distributed store cannot initialize safely

## Accessibility

The dashboard includes a real accessibility pass:

- keyboard access to panel controls, favorites, refresh, theme toggle, and
  modal open/close
- semantic table structure
- native dialog semantics with focus restoration
- explicit favorite labels and `aria-pressed`
- visible focus states
- component and E2E coverage for keyboard flows

## Testing

Coverage includes:

- unit and component tests with Vitest and Testing Library
- route and server tests for contracts, rate limiting, caching, and errors
- favorites quote route coverage, demo resolution, and stale local fallback
- Playwright dashboard interaction E2E
- Playwright SSR boot coverage with JavaScript disabled, plus direct HTML checks against the built app response

Reviewer-friendly commands:

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run validate
```

## Operational Runbook

See [docs/RUNBOOK.md](./docs/RUNBOOK.md) for:

- health checks
- request ID correlation
- debug metrics access
- how to interpret `degraded` health
- what to inspect when `/api/panel` fails
- what to inspect when `/api/stocks/[symbol]/history` fails
- how to reason about `429`
- upstream failure handling
- demo vs live identification
- basic config rollback

## Reviewer Checklist

- `npm run validate` passes locally
- SSR E2E passes
- dashboard E2E passes
- `/api/health` reports the expected mode
- CSP/security headers are present in production mode
- public demo deploy runs with `MARKET_DATA_SOURCE=demo`

## Known Limitations

- demo mode is synthetic and not real market data
- panel and history caches are process-local
- favorites quote cache and in-flight dedupe are process-local
- stale history fallback is process-local
- built-in metrics are process-local
- live mode still depends on an external upstream provider
- there is no external observability platform, tracing backend, or formal SLO
- favorites localStorage persists only minimal identity metadata
- `/api/favorites` avoids fetching full panels, but still fans out into N
  internal per-symbol quote lookups per batch
- favorites fan-out is process-local and concurrency-limited by
  `FAVORITES_QUOTE_CONCURRENCY` (default `4`, valid range `1-10`) to trade a
  bit of latency for upstream protection when many cold-cache favorites refresh
- stale local favorite snapshots are fallback-only and explicitly marked as
  outdated in the UI
- the project is not intended for live trading or financial advice

## Favorites Behavior

Favorites now persist only minimal client identity:

- `symbol`
- `market`
- optional `sourcePanel` metadata for UI continuity

The browser refreshes favorite quotes through `GET /api/favorites?items=...`.
That route validates and deduplicates the requested symbols, applies rate
limiting, resolves each favorite through the upstream individual quote endpoint,
normalizes the result to the same row model used by the panel tables, and
returns `rows`, `missingItems`, `failedItems`, source metadata, request ID, and
staleness markers.

There is no real upstream batch quote endpoint here. `/api/favorites` performs
an internal fan-out to individual quote lookups with process-local cache,
in-flight dedupe, and a bounded concurrency limit so a cold refresh does not
burst all favorites upstream at once.

Partial favorites degradation is communicated explicitly in the UI:

- `missingItems`: the symbol is not available in the current source
- `failedItems`: the lookup failed temporarily and may recover on the next refresh
- stale/local fallback: the dashboard is showing an outdated local snapshot

When live or demo quote refresh cannot resolve a favorite, the dashboard may
show an explicit local snapshot fallback labeled as outdated. This preserves
the UI without making local storage the primary source of truth.

## Screenshots

### Desktop

![Argentina Market Tracker desktop](./docs/screenshots/desktop.png)

### Historical Modal

![Argentina Market Tracker modal history](./docs/screenshots/modal-history.png)

### Mobile

![Argentina Market Tracker mobile](./docs/screenshots/mobile.png)

## Suggested Positioning

Example GitHub description:

`Market dashboard for Argentine equities with a Next.js BFF, validated external contracts, resilient historical data handling, protected demo/live modes, structured observability, and automated SSR/E2E verification.`
