# Set page loaders map API outcomes to ok, not-found (404 and 400) or unavailable, shared per request through React cache

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_120807` (search visibility phase 2)
- **Code:** `apps/web/src/lib/server-sets.ts`, `apps/web/src/app/sets/canonical/[id]/not-found.tsx`, `apps/web/src/app/sets/public/[id]/not-found.tsx`

## Context

[2026-11-26-public-pages-server-rendered-with-cached-api-data](2026-11-26-public-pages-server-rendered-with-cached-api-data.md) (c) says a real API 404 becomes `notFound()` and any other failure leaves the page at HTTP 200 with its client loading path. Each detail page needs the data twice, in `generateMetadata` and in the page. Failed fetches are not stored in Next's data cache, so two independent calls against a sleeping API would cost two 5 s timeouts. The API answers 400 for a malformed id (`ParseUUIDPipe`) and 404 for a missing or deleted set. Every user set is public, so there is no "exists but not visible" case.

## Decision

`apps/web/src/lib/server-sets.ts` (`import 'server-only'` first) exports `loadCanonicalSets`, `loadCanonicalSet(id)` and `loadPublicSet(id)`. Each is wrapped in React `cache()`, calls `serverApiGet` once with `{ revalidate: LIST_REVALIDATE_SECONDS }` and never throws. It returns `{ status: 'ok', data }`, `{ status: 'not-found' }` or `{ status: 'unavailable' }`.

- On the two detail loaders, a `ServerApiError` of kind `http` with status 404 or 400 gives `not-found`. Everything else (timeout, network, 5xx, 403, `config`, a non-`ServerApiError`) gives `unavailable`.
- The list loader maps every failure to `unavailable`.
- The detail pages call `notFound()` on `not-found`, and the segment's `not-found.tsx` renders `NotFoundContent` in the same `main` shell as `app/not-found.tsx`. The response is a real 404. `generateMetadata` never calls `notFound()`: for `not-found` and `unavailable` it returns generic metadata.
- On `unavailable` the page renders its client view with no initial data.

## Alternatives considered

- **Calling `serverApiGet` directly in each page and in `generateMetadata`.** Rejected: a cold API would cost two timeouts per request, and the error mapping would be repeated six times.
- **Treating 403 as not-found.** Rejected: the API has no non-public sets, so 403 never means the set doesn't exist.

## Consequences

- There is one place for the rule that only a definitive 404 or 400 is a real 404; a flaky API never produces a 404 that crawlers would drop from the index.
- A render waits at most one 5 s timeout on a cold API.
- Phase 3 pages can add loaders to this module or follow its shape.
