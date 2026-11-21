# Product analytics is PostHog Cloud in cookieless mode, never identifying users, behind a same-origin /relay proxy

- **Status:** Accepted
- **Date:** 2026-11-20
- **Source:** orchestrator run `run_20261120_225014` (growth backlog 0.6, privacy-friendly product analytics; the provider, cookieless mode, no-identify and proxy choices were the user's, set in the task's Decisions list)
- **Code:** `apps/web/src/lib/analytics.ts`, `apps/web/src/instrumentation-client.ts`, `apps/web/next.config.ts`, `apps/web/.env.example`, `apps/web/src/app/privacy/page.tsx`, `apps/api/scripts/retention-report.ts`

## Context

The owner needs a sign-up and collection funnel (sign-up, set created or cloned, coins marked owned, want list exported) without a cookie banner and without personal data about collectors. The web app is on Vercel and had no product analytics.

## Decision

- **Provider:** PostHog Cloud, through `posthog-js` pinned exactly. `src/lib/analytics.ts` is the only module that touches the SDK; the rest of the app calls a typed `track()` with a closed list of five events (`user_signed_up`, `set_created`, `set_cloned`, `coins_marked_owned`, `want_list_exported`).
- **Cookieless:** `cookieless_mode: 'always'`. Nothing is written to browser storage, so no consent banner. A `/privacy` page (EN/ES) is linked from the footer.
- **No identity:** `person_profiles: 'never'`, and the code never calls identify, alias or group.
- **No automatic capture:** `autocapture: false`. The config also turns off rageclick, dead clicks, heatmaps, exception capture, session recording and surveys. Sentry keeps error reporting.
- **URLs stripped:** `before_send` (`beforeSend`) rewrites every URL-like string in an event's properties, `$set` and `$set_once` to path only, keeping the query keys `utm_source`, `utm_medium`, `utm_campaign` and `ref`. The first `utm_source` (else `ref`) of a tab is kept in module memory as the sign-up `channel`, default `direct`.
- **Reverse proxy:** `api_host` is `/relay`. `next.config.ts` rewrites, in this order, `/relay/static/:path*` and `/relay/array/:path*` to `https://{region}-assets.i.posthog.com/...` and then `/relay/:path*` to `https://{region}.i.posthog.com/...`, so the asset paths match before the catch-all. The region comes from `NEXT_PUBLIC_POSTHOG_REGION`, `us` unless it is `eu`. `skipTrailingSlashRedirect: true` is set because PostHog's proxied requests end in slashes.
- **Off by default:** without `NEXT_PUBLIC_POSTHOG_TOKEN`, `initAnalytics()` returns before importing anything, and `track()` is a no-op. `posthog-js` is loaded with a dynamic `import()` only when the token is set, so visitors with analytics off never download the SDK.
- **Retention outside PostHog:** week-two retention comes from the database. `apps/api/scripts/retention-report.ts` is read-only. It buckets users by ISO week of `User.createdAt` and counts those with 5 or more owned coins and those who marked coins in two or more ISO weeks, using `Ownership.ownedAt` as the activity date. It prints only week keys and counts.

## Alternatives considered

- **Plausible or Umami-style page-view tools:** weak at custom events and funnels, which is what the owner wants.
- **Vercel Web Analytics:** the same weakness, and tied to the host.
- **PostHog with cookies:** better identity, but needs a consent banner.
- **Calling PostHog's hosts directly:** ad blockers drop the events, so the proxy was chosen.
- **Measuring retention in PostHog:** impossible in cookieless mode (see below), hence the database script.
- **Adding `Ownership.createdAt` for the report:** a schema change, out of scope.

## Consequences

- No session replay and no surveys.
- Cookieless mode hashes visitors on the server with a daily salt, so unique users across days are overcounted and cross-day retention cannot be measured in PostHog.
- `ownedAt` reflects the latest marking: un-marking and re-marking a coin replaces its row, so the report understates earlier activity.
- Cookieless events are dropped unless the PostHog project's cookieless setting is switched on in PostHog. This is not visible in the repo.
- `/relay` traffic counts toward Vercel data transfer (small, with no replay).
- `skipTrailingSlashRedirect: true` applies to every route: `/catalog/` no longer redirects to `/catalog`, and external links with a trailing slash may 404.
- The region rule is duplicated in `next.config.ts`, which cannot import from `src/`; the two must stay in step.
- Events fired before the dynamic import resolves are dropped, and a sign-up whose follow-up login fails sends no `user_signed_up`.
- The `set_created` type allows `filter` and `manual`, but `/sets/new` emits only `blank` (and `set_cloned` for clones), because sets are created empty ([2026-10-13-new-set-created-in-one-request](2026-10-13-new-set-created-in-one-request.md)).
- Revisit if the owner needs cross-day retention in PostHog (that needs cookies and a consent banner) or session replay.
