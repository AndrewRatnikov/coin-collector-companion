# PRD: Catalog endpoints + Wikipedia attribution footer (backlog_week1.md 5.1–5.2)

**Run:** run_20260719_190933
**Date:** 2026-07-19

## Goal

Collectors need a way to browse and look up known coin types before they can build sets or track ownership (future weeks). This task delivers the read-only catalog API (`GET /catalog`, `GET /catalog/:id`) backed by the already-imported 142-row Lincoln Wheat Cent dataset, plus the shared TypeScript types both `apps/api` and `apps/web` will use to talk about catalog data. It also satisfies the project's outstanding Wikipedia CC BY-SA 4.0 attribution obligation for that imported data with a single global footer line in the web app. Nothing here depends on live external calls — the catalog is Postgres-only at request time.

## User stories

- As a frontend developer, I want a `GET /catalog` endpoint with country/denomination/name/year-range filters and pagination so I can build a catalog browsing UI later without waiting on more backend work.
- As a frontend developer, I want `GET /catalog/:id` to fetch full details for a single coin type so I can build a detail view.
- As an anonymous visitor, I want to query the catalog without logging in, since it's public reference data, not user data.
- As the project maintainer, I want CC BY-SA 4.0 attribution for Wikipedia-derived catalog data visible on every page so the project meets its licensing obligation without per-page bookkeeping.
- As a consumer of `packages/shared`, I want `CatalogCoin` and `PaginatedResponse<T>` types available so both apps share one definition of the catalog response shape.

## Acceptance criteria

1. `GET /catalog` requires no `Authorization` header and returns HTTP 200 (not 401) — confirmed against the live Neon dev DB.
2. `GET /catalog?country=USA` returns only rows where `country` exactly equals `"USA"`.
3. `GET /catalog?denomination=Cent` returns only rows where `denomination` exactly equals `"Cent"` (plain string comparison, no enum).
4. `GET /catalog?name=lincoln` (lowercase) matches rows whose `name` contains "Lincoln" case-insensitively (substring, not exact).
5. `GET /catalog?yearMin=1920&yearMax=1930` returns only rows with `year` inclusively between 1920 and 1930; `yearMin` and `yearMax` each work independently when the other is omitted.
6. `GET /catalog` with no `page`/`limit` defaults to `page=1`, `limit=20`.
7. `GET /catalog?limit=1000` is capped to a sane maximum (e.g. 100), not honored literally.
8. Response body shape is exactly `{ items, page, limit, total }`, where `total` is the full filtered row count (not `items.length`) and is consistent with `items.length` across at least two consecutive pages (e.g. page 1 and page 2 together account for `total` correctly, no row skipped or duplicated at the page boundary).
9. `GET /catalog/:id` with a valid, existing UUID returns the matching coin's full record with HTTP 200.
10. `GET /catalog/:id` with a malformed (non-UUID) id returns HTTP 400.
11. `GET /catalog/:id` with a well-formed UUID that matches no row returns HTTP 404.
12. No `fetch`/`axios`/external HTTP call exists anywhere in `CatalogModule`'s request path (verified by code review, not just testing) — a filter that matches nothing returns an empty result, not a live fallback lookup.
13. `packages/shared/src/index.ts` exports a `CatalogCoin` type (mirroring the fields `GET /catalog`/`GET /catalog/:id` actually return) and a generic `PaginatedResponse<T>` type (`{ items: T[]; page: number; limit: number; total: number }`), and `pnpm --filter @coin-collector/shared build` succeeds.
14. `apps/web`'s root layout renders a one-line, unobtrusive (small/muted) footer on every route, attributing Wikipedia-derived catalog data under CC BY-SA 4.0 with a hyperlink back to Wikipedia — verified by loading at least two different routes in a running `pnpm --filter web dev` session.
15. `pnpm --filter @coin-collector/shared build`, `pnpm --filter api typecheck`/`build`/`test`, `pnpm --filter web typecheck`/`build`, and `pnpm lint` all pass cleanly.
16. `docs/backlog_week1.md` items 5.1, 5.2, and 5.3 are checked off with short "Done: ..." notes, and `CLAUDE.md`'s "Project status" section has a new dated changelog paragraph in the established style, inserted immediately before the "Catalog import script (2026-07-19)" entry's predecessor position (i.e., directly after the last v2 entry, before the old historical paragraph).

## Out of scope

- Sets, canonical sets, ownership, or collection endpoints of any kind (Week 2 work) — `CatalogModule` must not import or reference `UserSet`, `CanonicalSet`, or `Ownership`.
- Any live/runtime call to Wikipedia or Wikimedia Commons from the catalog request path — attribution is a static footer line, and missing catalog data is simply absent, never fetched live.
- Cursor-based pagination, a cache layer, or cursor/hash-based dedup — only plain `page`/`limit` query params.
- Reintroducing a `Denomination` enum on the Prisma schema or anywhere else — `denomination` stays a plain string.
- Live/autocomplete search UX — the catalog query is a plain filter form contract, not a typeahead API.
- Per-page or per-article Wikipedia attribution — a single global link to Wikipedia satisfies the licensing requirement for this task.

## Open questions

None — the task specification is fully concrete (exact schema, exact endpoint contracts, exact response shape, exact verification steps) and requires no clarification before planning.
