# The set pages are server components that pass their data to client views as TanStack initialData, with no refetch in the browser

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_120807` (search visibility phase 2: server-render the checklist and public set pages)
- **Code:** `apps/web/src/app/sets/canonical/page.tsx`, `apps/web/src/app/sets/canonical/[id]/page.tsx`, `apps/web/src/app/sets/public/[id]/page.tsx`, `apps/web/src/components/sets/canonical-sets-list-view.tsx`, `apps/web/src/components/sets/canonical-set-detail-view.tsx`, `apps/web/src/components/sets/public-set-detail-view.tsx`, `apps/web/src/lib/hooks/use-canonical-sets.ts`, `apps/web/src/lib/hooks/use-public-sets.ts`

## Context

[2026-11-26-public-pages-server-rendered-with-cached-api-data](2026-11-26-public-pages-server-rendered-with-cached-api-data.md) (d) said server-rendered pages hand anonymous data to client components "as props or initial data" and keep the signed-in layer in the existing queries. This run converted the three set pages. They were `'use client'` pages with markup, test ids and signed-in behaviour that the existing page tests lock down, and they read `getStoredToken()` after mount.

## Decision

- Each page file is an async server component. Its UI moved, unchanged in markup, classes, strings and test ids, into a client view in `components/sets/`: `CanonicalSetsListView`, `CanonicalSetDetailView`, `PublicSetDetailView`. The view takes the id and the server data as props (`initialSets`, `initialSet`).
- `useCanonicalSets`, `useCanonicalSet` and `usePublicSet` accept an optional `{ initialData }`. When it is defined, the query gets `initialData`, `staleTime: Infinity`, `refetchOnMount: false` and `refetchOnWindowFocus: false`, so the browser never fetches the set after a successful server render. When it is undefined, the options are exactly the old ones: the existing browser query is the fallback when the server couldn't load the data.
- The views read `getStoredToken()` only inside the mount effect, so the first client render matches the server HTML. This fixes the hydration mismatch from backlog 2.7 on these three pages. The signed-in layer (progress, Owned/Missing marks, "Start this set") attaches after mount through the existing queries.
- A page file exports only `default` and `generateMetadata`; helpers live in `lib/`.
- The existing page tests now render the views directly with no initial data (the fallback path). Two `toHaveBeenCalledWith(id)` assertions became first-argument checks because the hooks can receive a second argument.

## Alternatives considered

- **Prefetch on the server with a `QueryClient` and `dehydrate` / `HydrationBoundary`.** Rejected: it needs a per-request server QueryClient and a provider change, which is more machinery than one prop.
- **Separate server-only markup, keeping the client page for interactivity.** Rejected: it duplicates the markup and breaks DOM and test-id parity.

## Consequences

- Phase 3 (`/catalog`, `/catalog/[coinId]`) can repeat this pattern.
- The public set page's coin list comes from the 1-hour data cache and is not refetched in the browser, so an owner's edit can take up to an hour to show on `/sets/public/[id]`. The owner sees fresh data on their own set page, and the signed-in progress (gaps) query stays live. A shorter revalidate was rejected because it wakes Render and Neon more often for crawler traffic.
- On a cold API the page renders with the old client loading path and no JSON-LD on the detail pages.
- Async server components can't be rendered by React Testing Library, so page-level behaviour is tested through the views, and server rendering through `server-render.test.tsx` files next to each page.
