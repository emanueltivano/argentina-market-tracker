# Argentina Market Tracker

[![CI](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/emanueltivano/argentina-market-tracker/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-green)

Portfolio full-stack dashboard for Argentine equities built with Next.js,
React, and TypeScript.

This repository is intentionally positioned as a portfolio/demo project. The
goal is to show practical frontend and full-stack engineering decisions around
server/client boundaries, validated external data, resilient UI states,
performance-minded client behavior, and automated verification. It is not
presented as an enterprise-grade trading platform.

## What Problem It Solves

Argentina Market Tracker exposes market panels and per-symbol historical data
from a protected external API without leaking credentials to the browser.

The browser interacts only with stable internal routes such as:

- `/api/panel?type=lider|general|cedears`
- `/api/stocks/[symbol]/history?range=...&market=...`

Those routes handle request validation, upstream normalization, controlled error
mapping, local cache/rate-limit rules, and app-level response contracts that
the UI can render safely.

From a portfolio perspective, the project demonstrates how to build a market
dashboard that is more robust than a simple client-only demo, while still being
small enough to review in an interview or take-home discussion.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript with strict mode
- Tailwind CSS 4
- SWR
- `lightweight-charts`
- Vitest
- Playwright
- GitHub Actions

## Main Features

- Dashboard panels for major Argentine market groupings
- Server-side initial dashboard load with client revalidation
- Per-symbol detail modal with historical chart and range switching
- Favorites persisted locally
- Sorting by ticker, price, variation, and volume
- Manual refresh with cache bypass
- Responsive loading, empty, success, stale, and error states
- Internal API contracts that shield the UI from upstream API inconsistencies

## Architecture Overview

```txt
Browser
  App Router page + client dashboard
        |
        | GET /api/panel?type=...
        | GET /api/stocks/[symbol]/history?range=...
        v
Next.js Route Handlers
  Request validation
  Contract normalization
  In-memory cache / cooldown / rate limiting
        |
        v
Server-only external API client
  Credentials
  OAuth token handling
  Timeout / upstream protection
        |
        v
External market API
```

General structure:

```txt
src/
  app/
    api/
      panel/
      stocks/[symbol]/history/
      token/
    dashboard/
      components/
      hooks/
      lib/
  lib/
    server/
```

The client is intentionally kept on validated, app-level data contracts.
Credentials, token refresh, and upstream-specific details stay in the server
layer.

## Technical Highlights

- **App Router**
  - The project uses Next.js App Router with SSR-first bootstrapping for the
    initial dashboard render.

- **Server-side API boundaries**
  - The browser never calls the external market provider directly.
  - Credentials and upstream integration stay behind internal route handlers.

- **Contract validation**
  - External panel and historical payloads are validated and normalized before
    they reach the UI.
  - Invalid or partial upstream responses are rejected with controlled app
    errors instead of leaking inconsistent state to components.

- **Polling optimized with Visibility API**
  - Dashboard polling pauses when the browser tab is hidden.
  - Returning to the tab can trigger a refresh when the refresh interval has
    already elapsed.

- **Lazy-loaded chart modal**
  - The stock detail modal is loaded dynamically.
  - As a result, the historical chart and `lightweight-charts` are deferred
    until the user actually opens a stock detail view.

- **Tests unitarios/componentes**
  - The project includes unit tests, component tests, hook tests, route-level
    tests, and Playwright E2E coverage.

## Technical Decisions

- **Backend-for-frontend approach**
  - A local BFF layer was chosen to avoid exposing credentials and to provide a
    stable contract for the frontend.

- **Validated data before UI rendering**
  - The frontend works with normalized data rather than raw external payloads.
  - This keeps UI logic simpler and reduces the chance of invalid states
    leaking into rendering paths.

- **SWR for client refresh behavior**
  - SWR handles revalidation and client refresh flows while SSR provides the
    initial render.

- **Incremental state extraction on the dashboard**
  - `Panel.tsx` was kept as a coordinator while URL/panel state and modal
    selection logic were extracted into smaller hooks.

- **Performance over unnecessary upfront JS**
  - The chart path was deferred because historical visualization is secondary to
    the initial dashboard table.

## Performance Optimizations

- Server-rendered initial panel to reduce empty-client boot experience
- SWR hydration to avoid an unnecessary duplicate fetch on mount when initial
  data exists
- Polling paused on hidden tabs using `document.hidden`
- `visibilitychange` refresh path to avoid stale data when the user returns
- Lazy-loaded stock detail modal, which defers chart-related JS
- Lightweight client refresh path that distinguishes normal polling from manual
  cache-bypass refresh

## Testing and Validation

The test suite covers the most important behaviors for a project of this scope:

- external response validation and normalization
- server-side token/cache/rate-limit behavior
- route handler contracts and controlled errors
- dashboard hooks and local state flows
- component behavior across loading/error/empty/success states
- modal behavior and favorites flows
- end-to-end interactions with deterministic mocks

CI runs through GitHub Actions and validates:

- lint
- type-check
- unit/component/route tests
- production build
- Playwright E2E

## Commands

### Installation

```bash
npm install
cp .env.local.example .env.local
```

### Development

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run type-check
```

### Tests

```bash
npm run test
```

Optional E2E:

```bash
npm run test:e2e
```

### Build

```bash
npm run build
```

### Full Local Validation

```bash
npm run validate:local
```

## Environment Variables

Use `.env.local.example` as the reference file.

| Variable | Required | Description |
| --- | --- | --- |
| `API_URL` | Yes | External market API base URL, without trailing slash |
| `NEXT_PUBLIC_SITE_URL` | Recommended for public deploys | Public site URL for metadata/Open Graph |
| `TOKEN_ENDPOINT` | No | Token endpoint path, defaults to `token` |
| `API_USERNAME` | Yes | External API username |
| `API_PASSWORD` | Yes | External API password |
| `PANEL_LIDER_ENDPOINT` | Yes | Upstream endpoint for the leader panel |
| `PANEL_GENERAL_ENDPOINT` | Yes | Upstream endpoint for the general panel |
| `PANEL_CEDEARS_ENDPOINT` | Yes | Upstream endpoint for CEDEARs |
| `ENABLE_TOKEN_DEBUG` | No | Enables local-only debug routes when set to `1` |

## Screenshots

### Desktop

![Argentina Market Tracker desktop](./docs/screenshots/desktop.png)

### Historical Modal

![Argentina Market Tracker modal history](./docs/screenshots/modal-history.png)

### Mobile

![Argentina Market Tracker mobile](./docs/screenshots/mobile.png)

## Known Limitations / Production Considerations

- **Rate limiting is in-memory**
  - It is useful for a single process or local demo, but it is not a
    distributed protection layer.

- **Cache is in-memory**
  - Cached panel/history behavior is process-local and would not be shared
    across multiple instances.

- **CSP is still pending**
  - Security headers were improved, but a stricter Content Security Policy is
    still an open production hardening task.

- **Favorites rely partially on local snapshots**
  - Favorites can fall back to locally persisted snapshots when the live source
    panel is unavailable, which is useful for resilience but not a substitute
    for durable backend persistence.

- **No persistent shared infrastructure**
  - There is no Redis/KV/distributed coordination for cache, cooldowns, or rate
    limits.

- **Not intended for live trading**
  - This project is suitable for portfolio review and technical discussion, not
    for real-money trading workflows.

## MVP Scope and Honest Tradeoffs

- The project prioritizes clear engineering decisions over broad product scope.
- Historical data is fetched on demand and not persisted by the app.
- There is no analytics, tracing, or third-party observability platform.
- The architecture is intentionally small enough to review in a technical
  interview without becoming a large SaaS codebase.

## Suggested Portfolio Positioning

Example GitHub description:

`Market dashboard for Argentine equities with a Next.js BFF, validated external contracts, historical charts, optimized polling, lazy-loaded modal charts, and automated tests.`

Suggested topics:

`nextjs`, `typescript`, `react`, `tailwindcss`, `vitest`, `playwright`, `portfolio`, `bff`, `financial-dashboard`

