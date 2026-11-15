# The API sends helmet's default security headers unchanged, with no CSP relaxation, including on Swagger UI

- **Status:** Accepted
- **Date:** 2026-11-15
- **Source:** orchestrator run `run_20261115_182713` (backlog step 0.7, security headers on the API; the task asked for the CSP to be "set accordingly" and for the ADR to say what was relaxed)
- **Code:** `apps/api/src/configure-app.ts`, `apps/api/src/configure-app.spec.ts`, `apps/api/test/health.e2e-spec.ts`, `apps/api/package.json`, `apps/api/src/main.ts`, `apps/web/src/lib/api-client.ts`

## Context

The API sent no security headers. The task was to add them with `helmet` in `configureApp`, so that `main.ts` and the e2e apps both get them, while keeping two things working: Swagger UI at `/api/docs` (mounted by `main.ts` with `SwaggerModule.setup('api/docs', ...)` after `configureApp`) and credentialed CORS for the web origin. The expectation was that the CSP would have to be loosened for Swagger.

The Architect checked this before choosing. With Nest 12.3, `@nestjs/swagger` 12.0.5 (swagger-ui-dist 5.x), helmet 8.3.0 and headless Chromium, `/api/docs` loaded under helmet's default CSP, rendered the spec and ran "Try it out" with no CSP violations. The Swagger HTML loads `swagger-ui-bundle.js`, `swagger-ui-standalone-preset.js` and `swagger-ui-init.js` as external same-origin scripts (`main.ts` passes no `customJsStr`). Its one inline `<style>` block and inline `style=` attributes are covered by helmet's default `style-src 'self' https: 'unsafe-inline'`, its icons are `data:` images covered by `img-src 'self' data:`, and "Try it out" calls the same origin. GET and preflight from `http://localhost:3000` still returned `Access-Control-Allow-Origin` echoing the origin and `Access-Control-Allow-Credentials: true` next to the helmet headers.

## Decision

`configureApp` calls `app.use(helmet())` with no options, after the `trust proxy` block and before `cookieParser()`. It applies to every path, including `/api/docs`. Because `app.use` registers on the Express instance before `main.ts` adds the Swagger routes, the docs get the same headers.

**Nothing was relaxed.** There is no `contentSecurityPolicy: false`, no path-scoped docs policy, no `'unsafe-inline'` or `'unsafe-eval'` added to `script-src`, and no override of `crossOriginResourcePolicy` or `crossOriginOpenerPolicy`. The only `'unsafe-inline'` in the policy is the one helmet already ships in `style-src`.

Resulting headers (helmet 8.3.0 defaults): a CSP of `default-src 'self'` with `script-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`, `frame-ancestors 'self'`, `img-src 'self' data:`, `style-src 'self' https: 'unsafe-inline'` and `upgrade-insecure-requests`; `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin`; `Strict-Transport-Security: max-age=31536000; includeSubDomains`; `Referrer-Policy: no-referrer`; `X-Content-Type-Options: nosniff`; `X-Frame-Options: SAMEORIGIN`; and others. `X-Powered-By` is removed. `Cross-Origin-Embedder-Policy` stays off, which is helmet 8's default.

CORS stays in `app.enableCors`, unchanged. The CORP and COOP defaults are kept because they don't touch it: the web app reaches the API only through `fetch(..., { credentials: 'include' })` in `apps/web/src/lib/api-client.ts`, a CORS-mode request. Browsers enforce CORP only on `no-cors` loads such as `<img>` and `<script>`, and coin images come from Wikimedia, not the API. COOP only affects documents the API serves itself, which means Swagger.

The unit spec makes a real request through `configureApp` and the health e2e spec asserts the headers on `GET /api/v1/health`. The dependency is `helmet` `^8.3.0` in `apps/api`, released about four months before the run, so it clears `minimumReleaseAge`. `pnpm-workspace.yaml` is untouched.

## Alternatives considered

- **A looser CSP scoped to `/api/docs*`** (for example allowing inline scripts). Rejected: Swagger UI has no inline scripts here, and its inline styles and `data:` images are already allowed. It would add attack surface for no gain and need path-switching middleware.
- **A looser CSP applied globally.** Rejected: it weakens every JSON route for the sake of one docs page.
- **`contentSecurityPolicy: false`.** Rejected: it drops the protection entirely, and the task asked for a CSP.
- **Moving the Swagger setup into `configureApp` to tune its CSP alongside.** Rejected as out of scope for this step.
- **CORP `cross-origin` or `same-site`, or turning CORP or COOP off.** Rejected: CORP is not involved in CORS-mode `fetch`, and the web app (Vercel) and API (Render) are different sites, so `same-site` would not help anyway.

## Consequences

- Every response, including errors and the docs, carries the same headers, and the e2e apps see what production sees.
- Swagger customisation is now constrained. Adding `customJsStr`, inline script, or assets from another origin to `SwaggerModule.setup` will be blocked by the CSP. The fix then is a policy scoped to the docs path, not a global loosening.
- `upgrade-insecure-requests` can break the docs on a plain-http, non-localhost host. Production is https, and localhost is exempt.
- If the web app ever embeds an API URL as an `<img>`, `<a download>` or other `no-cors` load, `Cross-Origin-Resource-Policy: same-origin` will block it and this decision needs revisiting.
- HSTS is set with `includeSubDomains` and no `preload`. The max-age is one year.
- Checked in headless Chromium against the same package versions; the check against the real `main.ts` in a browser and against the deployed Render host is on the handoff checklist.
