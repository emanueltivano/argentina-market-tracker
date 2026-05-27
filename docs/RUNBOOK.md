# Runbook

Operational notes for the production-oriented demo deployment of
`argentina-market-tracker`.

## Fast Checks

### Health

```bash
curl -i http://localhost:3000/api/health
```

Expected:

- HTTP `200`
- `status: "ok"` for a healthy demo instance
- `status: "degraded"` when runtime checks detect incomplete live config or a
  rate-limit/storage issue
- `X-Request-Id` response header for correlation

### Debug Metrics

Development and test:

```bash
curl -i http://localhost:3000/api/debug/metrics
```

Production:

```bash
curl -i \
  -H "x-observability-token: $OBSERVABILITY_DEBUG_TOKEN" \
  https://your-deploy.example.com/api/debug/metrics
```

Notes:

- Do not share `OBSERVABILITY_DEBUG_TOKEN`.
- The endpoint returns aggregated metrics only, not raw upstream payloads.
- If the token is missing or invalid in production, the endpoint returns
  `404` or `401` without revealing metrics.

## Request ID Correlation

Every internal API route returns `X-Request-Id`.

Example:

```bash
curl -i http://localhost:3000/api/panel?type=lider
```

Use the returned `X-Request-Id` value to correlate:

- client-visible failures
- structured server logs
- health/debug requests during incident review

## How to Interpret `degraded` Health

Common `degraded` causes:

- `MARKET_DATA_SOURCE=live` but one or more required live env vars are missing
- rate-limit runtime could not initialize as expected
- operational config is incomplete for the selected mode

What to check:

1. `dataSource` in `/api/health`
2. `checks.config.missingLiveConfig`
3. `checks.rateLimit`
4. deployment environment variables

## If `/api/panel` Fails

Check in this order:

1. `GET /api/health`
2. `GET /api/debug/metrics` and inspect:
   - `api.request.total`
   - `panel.cache.event.total`
   - `rate_limit.check.total`
   - `upstream.request.total`
3. server logs for the matching `X-Request-Id`
4. current `MARKET_DATA_SOURCE`

Typical causes:

- invalid or missing live env config
- upstream auth/token failure
- upstream panel endpoint failure
- distributed rate-limit store not configured as expected in live mode
- process-local rate-limit fallback causing conservative blocking

## If `/api/stocks/[symbol]/history` Fails

Check:

1. `GET /api/health`
2. `GET /api/debug/metrics` and inspect:
   - `history.cache.event.total`
   - `history.discarded_points.total`
   - `history.stale_fallback.total`
   - `history.variant.selected.total`
   - `upstream.request.total`
3. logs for the route request ID

Typical causes:

- upstream historical endpoint failure
- upstream returned only invalid points
- rate limiting
- no stale cache available for fallback on this instance

## If You See `429`

Interpretation:

- `/api/panel` or `/api/stocks/[symbol]/history` exceeded rate limits
- `/api/panel?refresh=1` may also hit refresh cooldown

What to do:

1. read `Retry-After`
2. inspect `X-RateLimit-*` headers
3. confirm whether the deployment is using:
   - `RATE_LIMIT_STORE=redis-rest`
   - `RATE_LIMIT_REDIS_REST_URL`
   - `RATE_LIMIT_REDIS_REST_TOKEN`
   - `RATE_LIMIT_TRUSTED_PROXY=vercel` on Vercel
4. inspect `rate_limit.check.total` in metrics

If live mode is public-facing and still using process-local memory buckets,
move to distributed storage before treating the deployment as serious.

## If Upstream Fails

Panel:

- panel requests fail closed with controlled `502` responses
- no raw upstream bodies are exposed

History:

- live history can fall back to stale cache if a previous success exists on the
  same instance and still falls within the stale window

Operator action:

1. confirm whether the app is in `demo` or `live`
2. inspect logs with `X-Request-Id`
3. inspect `upstream.request.total` and `history.stale_fallback.total`
4. if public portfolio stability matters more than live data, switch to
   `MARKET_DATA_SOURCE=demo`

## Demo vs Live

How to distinguish:

- `/api/health` reports `dataSource`
- history responses include `meta.source`
- the UI shows a `Demo data` badge in demo mode

Guidance:

- public portfolio deploy: use `demo`
- controlled private review of real upstream integration: use `live`

## Basic Config Rollback

Safe rollback order:

1. set `MARKET_DATA_SOURCE=demo`
2. remove or ignore live credentials
3. keep CSP, request IDs, and observability enabled
4. optionally remove `OBSERVABILITY_DEBUG_TOKEN` if production debug access
   should be disabled
5. redeploy

This is the safest fallback if the upstream, credentials, or distributed
rate-limit/storage configuration is unstable.
