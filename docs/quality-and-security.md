# Quality, operations and security baseline

This document describes the repository state at the time the reporting/quality baseline was added. It is intentionally advisory: this change does **not** alter existing API routes, middleware, security headers, deployment behavior, or the Docker publishing workflow.

## Current repository baseline

- The application is a Next.js 16 / React 19 application. `package.json` already provides `lint`, `test`, and `build` scripts; TypeScript is installed as a development dependency.
- The Docker build uses Node.js 22 and runs `npm ci` followed by the existing production build. The quality workflow uses the same Node major version to reduce CI/container drift.
- Vitest runs in a Node environment and discovers `src/**/*.test.ts`, so the situation-report tests require no test configuration changes.
- AOIs are already represented by `DrawnShape` in `src/lib/draw.ts`. A completed shape carries canonical GeoJSON plus measured area/perimeter data. `src/lib/situation-report.ts` consumes that model by type and copies only report-relevant geometry/measurements into the deterministic report snapshot.
- `src/components/SharePanel.tsx` currently shares map view state; it is not modified by this feature. `SituationReportPanel` is intentionally standalone so a later integration can decide which selected map/AOI data becomes report input.
- `src/app/api` contains many upstream-facing data routes (for example AI, air quality, aircraft, ArcGIS, CCTV, civil-protection, conflict and other feeds). These routes should be treated as an aggregation boundary: an upstream failure, slow response, oversized response, or abusive client request can consume server resources even when the upstream itself is public.
- `src/middleware.ts` currently performs page-view analytics and explicitly excludes `/api` from its matcher. API protection therefore should not be assumed to come from that middleware.
- `next.config.ts` sets global security headers. The current CSP is intentionally permissive (`'unsafe-inline'`, `'unsafe-eval'`, broad `https:` / `wss:` / `data:` / `blob:` allowances) and should be hardened incrementally rather than changed without compatibility testing.
- `.github/workflows/docker-publish.yml` publishes images from `master` and version tags. The new quality workflow is separate, read-only, uses no secrets, and performs no deployment.

## CI quality gate

`.github/workflows/quality.yml` runs for pushes and pull requests and performs, in order:

1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build`

The workflow grants only `contents: read`, uses the npm cache from `actions/setup-node`, and cancels an older run for the same branch/ref. It does not request package-write, deployment, OIDC, or secret access.

For branch protection, make the quality job a required check before merging to `master`. Keep Docker publishing independent so a failed quality gate never gains additional registry permissions.

## Rate limiting

There is no single rate-limit layer in this change. Add one before exposing high-cost routes to sustained public traffic.

Recommended starting policy, to be tuned with production telemetry:

- Public cacheable/read-only feed endpoints: **60 requests/minute per client IP**, burst up to 20 requests.
- Expensive aggregation, AI, large-area, or fan-out endpoints: **10 requests/minute per client identity/IP**, burst up to 3 requests.
- Any future mutation/admin endpoint: **10 requests/minute per authenticated identity** and a separate low IP ceiling to limit credential spraying.
- Return `429 Too Many Requests` with `Retry-After`; do not silently queue unlimited work.
- Enforce bounded query parameters: maximum result count, maximum time window, maximum AOI/bounding-box size, and maximum list lengths. Reject unreasonable requests before contacting upstream providers.

Prefer enforcement at the deployment edge/reverse proxy plus a server-side fallback for expensive routes. If the application is horizontally scaled, use a shared limiter rather than per-process counters.

## Authentication and authorization

Public situational feeds can remain anonymous only where that is an explicit product decision. Authentication should be required for operations that create cost, modify state, expose non-public data, or control external systems.

Recommended controls:

- Keep read-only public routes explicitly allowlisted rather than treating every `/api/*` route as public by default.
- Require authenticated user/service identity for future write, administrative, scanner-control, or privileged AI operations.
- Authorize server-side on every protected route; hiding a UI control is not authorization.
- Prefer short-lived sessions or scoped service tokens. Store provider credentials only server-side and never return them to clients or logs.
- For service-to-service access, use independently revocable tokens with least-privilege scopes and rotation dates.
- If a route accepts a user-supplied upstream URL in the future, use an allowlist and block private/link-local address ranges to prevent SSRF.

## API abuse protection

Apply cheap validation before expensive work:

- Validate method, content type, query types, enum values, coordinate ranges, and body size before making upstream calls.
- Use a small request-body ceiling for JSON control requests (for example 32 KiB unless a route demonstrably needs more).
- Bound AOIs, time ranges, pagination, and concurrent upstream fan-out. Avoid endpoints where one request can trigger an unbounded number of provider calls.
- Set explicit upstream timeouts and cancellation. Existing feed code already benefits from bounded network calls; make this a repository-wide rule.
- Cache provider responses where freshness permits and deduplicate concurrent requests for the same upstream resource.
- Preserve provider quotas. Where an API key has a documented quota, meter calls centrally and degrade to cached/last-known-good data rather than exhausting the quota early.
- Do not reflect raw upstream error bodies to clients. Return a stable local error shape and log the detailed provider failure server-side.
- Keep CORS closed by default. If cross-origin API consumers are added, allow only known origins/methods/headers instead of `*` for credentialed or privileged routes.

## Feed health monitoring

Each upstream feed should expose internal health telemetry independent of whether the HTTP route itself returned `200`.

Track at minimum:

- last fetch attempt and last successful fetch;
- fetch duration and upstream status/error class;
- item count returned and item count accepted after parsing;
- newest source timestamp / effective data age;
- parser failures and schema drift;
- cache/last-known-good usage;
- provider quota/rate-limit responses.

Suggested default alerts:

- **Warning:** two consecutive failures or data older than 2× the expected refresh interval.
- **Critical:** four consecutive failures, data older than 4× the expected refresh interval, or a sustained parser failure after an upstream schema change.
- Treat a successful request with unexpectedly zero records separately from a transport failure; an empty feed can be valid.

For incident review, retain enough structured metadata to answer which provider failed, when freshness crossed the threshold, and which user-facing layers were affected. Do not log provider secrets or full sensitive payloads.

## CSP hardening

The current CSP in `next.config.ts` is broad enough to permit inline/evaluated script behavior and any HTTPS/WSS host. Tightening it should be staged because MapLibre workers, map tiles, media streams, analytics, and other external providers can be affected.

Recommended sequence:

1. Inventory actual `script-src`, `style-src`, `connect-src`, `img-src`, `worker-src`, `media-src`, and `frame-src` destinations in production.
2. Introduce the intended stricter policy first as `Content-Security-Policy-Report-Only` and collect violations.
3. Replace broad `https:` / `wss:` allowances with explicit provider hosts where practical.
4. Remove `'unsafe-eval'` once the production bundle and MapLibre worker path are confirmed to work without it.
5. Replace `'unsafe-inline'` scripts with nonces/hashes. For styles, narrow separately after verifying framework and map-library requirements.
6. Add explicit `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors` policy matching the intended embedding behavior.
7. Keep HSTS and `X-Content-Type-Options`; evaluate the legacy `X-XSS-Protection` header separately because modern browsers rely on CSP instead.

Do not tighten CSP in the same change as unrelated feature work. A report-only observation period makes regressions visible before enforcement.

## Incident response

Use a small, repeatable process rather than improvising during an outage or credential leak:

1. **Detect and classify.** Record start time, affected routes/layers/providers, severity, and an incident owner.
2. **Contain.** Rate-limit or disable the abusive/failed route at the edge, revoke exposed tokens, and stop automated jobs that amplify the problem.
3. **Preserve evidence.** Save relevant application, proxy, provider-status, and CI/deployment logs with timestamps. Avoid copying secrets into tickets/chat.
4. **Recover.** Restore from last-known-good configuration/data, rotate credentials where needed, and verify the affected feeds from server to UI.
5. **Communicate.** Document user-visible impact and any degraded/stale data state. Prefer an explicit stale/degraded state over silently presenting old data as live.
6. **Review.** Within a short post-incident window, record root cause, detection gap, containment effectiveness, and concrete follow-up owners.

For a suspected provider-key leak: revoke/rotate the provider key first, inspect repository and CI logs for exposure, verify that no secret was committed, then restore service with the new credential. For abusive API traffic: preserve request metadata, apply an edge rule/rate limit, and verify that upstream quotas and application resources recover.

## Situation-report integration contract

`src/lib/situation-report.ts` is deliberately adapter-oriented. Existing application data should be converted into `SituationReportInput` at the integration point:

- pass an explicit `createdAt`; the generator never calls `Date.now()` or `new Date()` without an input value;
- pass the selected `DrawnShape` as `scope.aoi` and/or a human-readable `scope.region`;
- identify every source with a stable source ID and mark the sources active for that snapshot;
- map user-visible/selected incidents into prioritized events and chronological timeline entries;
- map transport/infrastructure layer observations into operational notices;
- explicitly represent stale, absent, contradictory, or partial coverage as data gaps/uncertainties;
- attach source IDs to events/notices/gaps so the report can build a reproducible source directory.

The normalizer canonicalizes timestamps, source URLs, ordering, missing optional values, and duplicate sources. Markdown and JSON serializers operate only on that normalized report, so the same logical input produces byte-identical output regardless of source/event input ordering.
