# Suggested GitHub Issues

## 1. Add a public demo deployment

Priority: High

Description:
Deploy the project to Vercel with server-side environment variables configured.
If live provider credentials cannot be used for a public demo, add an explicit
demo mode that serves realistic mocked market data without exposing secrets.

Acceptance criteria:
- A public URL is available and linked from the GitHub repository.
- Production environment variables are configured server-side only.
- `NEXT_PUBLIC_SITE_URL` matches the public origin.
- `ENABLE_TOKEN_DEBUG` is disabled in production.
- Dashboard, refresh, favorites, modal history and mobile layout are manually verified.

## 2. Add a production-safe demo data mode

Priority: High

Description:
Introduce a clearly named demo mode for portfolio deployments that cannot access
the real upstream API. The mode should preserve the same API contracts used by
the real BFF.

Acceptance criteria:
- Demo mode is controlled by a server-only environment variable.
- API responses keep the same `{ ok, data, fetchedAt, servedAt, cacheStatus }` shape.
- README documents when to use demo mode.
- Tests cover demo responses.

## 3. Add Lighthouse and accessibility reporting

Priority: Medium

Description:
Add a repeatable audit for performance and accessibility so portfolio quality
can be shown with evidence.

Acceptance criteria:
- Lighthouse or Playwright audit instructions are documented.
- Mobile and desktop scores are captured after production build.
- Any critical accessibility failures are fixed or tracked.

## 4. Improve mobile density with visual regression coverage

Priority: Medium

Description:
Refine the small-screen toolbar, table density and modal spacing, then protect
it with Playwright screenshots or assertions.

Acceptance criteria:
- Main dashboard fits comfortably on common mobile widths.
- Toolbar controls do not dominate the first viewport.
- Playwright covers at least one mobile dashboard flow.

## 5. Evaluate global rate limiting

Priority: Low

Description:
For real traffic, replace per-instance in-memory limits with Redis, Vercel KV,
Upstash or WAF rules.

Acceptance criteria:
- A target provider is selected.
- Serverless multi-instance behavior is documented.
- Existing local tests remain deterministic.

## Public Deploy Reminder

- Public deploys should choose between controlled real credentials and an
  explicit demo mode.
- `NEXT_PUBLIC_SITE_URL` must be set for correct metadata/social previews.
- Cache, cooldown and rate limiting are per process/serverless instance, not
  globally shared protections.
