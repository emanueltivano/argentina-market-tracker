# Suggested GitHub Issues

## 1. Add a public demo deployment

Priority: High

Description:
Deploy the project to Vercel with server-side environment variables configured. If live provider credentials cannot be used for a public demo, design an explicit demo mode that serves realistic mocked market data without exposing secrets.

Acceptance criteria:
- A public URL is available and linked from the GitHub repository.
- Production environment variables are configured server-side only.
- `ENABLE_TOKEN_DEBUG` is disabled in production.
- Dashboard, refresh, favorites, modal history and mobile layout are manually verified.

## 2. Add a production-safe demo data mode

Priority: High

Description:
Introduce a clearly named demo mode for portfolio deployments that cannot access the real upstream API. The mode should preserve the same API contracts used by the real BFF.

Acceptance criteria:
- Demo mode is controlled by a server-only environment variable.
- API responses keep the same `{ ok, data, fetchedAt, servedAt, cacheStatus }` shape.
- README documents when to use demo mode.
- Tests cover demo responses.

## 3. Add Lighthouse and accessibility reporting

Priority: Medium

Description:
Add a repeatable audit for performance and accessibility so portfolio quality can be shown with evidence.

Acceptance criteria:
- Lighthouse or Playwright audit instructions are documented.
- Mobile and desktop scores are captured after production build.
- Any critical accessibility failures are fixed or tracked.

## 4. Investigate Playwright shutdown behavior on Windows

Priority: Medium

Description:
In this local Windows environment, Playwright executes the E2E assertions successfully but the CLI process can remain open while shutting down the Next.js web server. The suite now runs against `next start` with one worker to reduce flakiness, but the shutdown behavior should be verified on CI and another Windows machine.

Acceptance criteria:
- `npm run test:e2e` exits with code 0 locally after printing the Playwright summary.
- CI confirms the E2E job exits cleanly.
- Any required Playwright or Next.js config change is documented.

## 5. Extract stock history infrastructure helpers

Priority: Medium

Description:
`src/app/api/stocks/[symbol]/history/route.ts` contains route handling, cache, in-flight deduplication, rate limiting and upstream endpoint composition. Extract cache and limit helpers to `src/lib/server` to match the panel route structure.

Acceptance criteria:
- Route file focuses on request validation and response orchestration.
- Cache and rate-limit behavior remains covered by tests.
- Public API contract does not change.

## 6. Add production observability

Priority: Medium

Description:
Add lightweight error and latency visibility for upstream calls and API route failures.

Acceptance criteria:
- Upstream error categories are logged without leaking credentials.
- Slow upstream calls can be identified.
- README documents the chosen observability approach.

## 7. Improve mobile density with visual regression coverage

Priority: Medium

Description:
Refine the small-screen toolbar, table density and modal spacing, then protect it with Playwright screenshots or assertions.

Acceptance criteria:
- Main dashboard fits comfortably on common mobile widths.
- Toolbar controls do not dominate the first viewport.
- Playwright covers at least one mobile dashboard flow.

## 8. Add a custom 404 page

Priority: Low

Description:
Create a branded `not-found.tsx` that routes users back to the dashboard and keeps the portfolio presentation polished.

Acceptance criteria:
- Unknown routes render a project-specific 404 page.
- The page includes a clear link back to `/`.
- Styling matches the existing dashboard.

## 9. Evaluate global rate limiting

Priority: Low

Description:
For real traffic, replace per-instance in-memory limits with Redis, Vercel KV, Upstash or WAF rules.

Acceptance criteria:
- A target provider is selected.
- Serverless multi-instance behavior is documented.
- Existing local tests remain deterministic.
