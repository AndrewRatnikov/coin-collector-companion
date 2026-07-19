# Coin Collector Companion — Build Roadmap

**Author:** Andrew Ratnikov | **Date:** 2026-07-19 | **Status:** Draft | **Based on:** `prd_v2.md`, `system-design_v2.md`

## Assumptions

- Close to full-time availability.
- Existing state: apps/web and apps/api scaffolding in place, plus some initial Prisma/Neon connection already done — this plan doesn't replan that setup work.
- Backend-first: the full API surface (§3 of the design doc) is functional and manually testable before frontend work starts.
- Target: roughly 3 weeks to a working v1, matching the PRD's "few weeks" soft target — 2 weeks backend, 1 week frontend, small buffer.
- Once Week 1's catalog import has landed real data in the dev DB, treat it as worth protecting: avoid `prisma migrate reset` out of habit for the rest of the build, and verify schema/query changes against the fixtures saved in Week 1 rather than re-running the full import every time (see Week 1).

## Week 1: Backend foundations

- **Day 1 — licensing/ToS check, before writing any import code:** confirm the license/terms of whichever open source(s) v1 seeds from (Wikipedia mintage lists / US Mint publications, Wikimedia Commons images — including per-image license handling for Commons, since it isn't all public domain like the US Mint's own imagery, see design doc §4.3). Expected to be a quick confirmation, but it's a day-one gate, not a buffer-week afterthought — don't start the import script until it's checked.
- **Half-day — pull real fixtures:** fetch real data from the chosen open source(s) for the example catalog scope (US cents) and save the results as fixtures in the repo, before finalizing the Prisma schema below, so the schema is checked against real data shapes rather than assumptions about them.
- Finalize the Prisma schema (design doc §4.1): `coins` (`numista_type_id` nullable/non-unique — enrichment only, not identity; `mint_mark`/`variety` `NOT NULL` with `''` default; per-coin uniqueness enforced by the DB on `(country, denomination, year, mint_mark, variety)`; `name` for catalog search; `image_source`/`image_license` recorded per row), `canonical_sets`, `canonical_set_coins` (with `position`), `user_sets` (with `cloned_from_canonical_id` and `cloned_from_user_set_id`, both nullable — no `is_public` column, every set is public in v1, §4.6), `user_set_coins` (with `position`), `ownership`. No `tags`/`coin_tags` — theme/subject tagging is cut from v1 entirely (§4.1), not just deferred. No `sync_log` — dropped along with runtime catalog sync (§4.3). Run the first migration against Neon.
- **Neon Auth spike — time-boxed, ~2 days, with a fallback decision point:** `AuthGuard` with JWKS verification (§4.2), tested against a manually issued token before any real frontend exists. This integration was never actually validated, so treat it as a spike, not a given. **By mid-week:** if JWKS verification isn't working, stop and switch to hand-rolled email/password + JWT instead of continuing to sink time into it — don't let this block Week 2's domain logic, which depends on *some* working `AuthGuard`, not specifically Neon Auth.
- Build the catalog import script (`scripts/import-catalog`, design doc §4.3): reads the open-source data, normalizes it, imports only public-domain-tagged images (recording `image_source`/`image_license` per row), upserts into `coins` deduped on the natural key. **Explicitly sanitize `mint_mark`/`variety` before they reach Prisma** — any of `null`, `undefined`, or a source-specific "none" placeholder (`"None"`, `"N/A"`, whitespace) must coerce to the literal `''`, not just whatever the scraper happened to return; the DB's uniqueness constraint (§4.1) only dedupes correctly if `''` is the one and only representation of "no mint mark" that ever gets written, and a stray alternate placeholder defeats it silently (no error, just a duplicate coin polluting the catalog). Resumable and idempotent by design — no Numista client needed for v1.
- Catalog module: `GET /catalog` (filter by country/denomination/coin name/year range, paginated via `page`/`limit`) — serves purely from Postgres, no runtime external call; `GET /catalog/:id`.
- Add a one-line attribution note in the web app's footer for Wikipedia-derived catalog data (CC BY-SA) — cheap, and removes any ambiguity about the open-source strategy's attribution obligations (design doc §4.3).

**Checkpoint:** the import script loads the example scope's real data (from the saved fixtures) into Postgres, and `GET /catalog` with a real filter returns it — with no external call anywhere in the request path.

## Week 2: Backend domain logic

- Sets module: `POST /sets` (blank, clone-from-canonical, or clone-from-another-user's-public-set — one `cloneFrom` shape covering both, §4.6), `PATCH /sets/:id`, `PATCH /sets/:id/coins` (adds append at `max(position) + 1` within that set, skip-on-conflict against `@@unique([userSetId, coinId])` so a double-click/retry/overlapping filter re-add is a no-op rather than a duplicate slot — no mid-set insertion or drag-and-drop reordering in MVP, §4.1), `DELETE /sets/:id` (cascades to `user_set_coins` only — must never touch `ownership`; a coin stays owned everywhere else after its set is deleted, §4.1) (all three owner-only), `GET /sets`. **Register `SetsController`'s literal-segment routes (`GET /sets/canonical`, `GET /sets/public`) before the `:id` routes** (`GET /sets/:id/gaps`, `PATCH`/`DELETE /sets/:id`) — NestJS matches in declaration order, and getting this backwards silently captures `"canonical"`/`"public"` as `:id` (§3). Add `ParseUUIDPipe` on `:id` regardless, so any future ordering slip fails loud (400) instead of confusing (404).
- Canonical sets: `GET /sets/canonical`, `GET /sets/canonical/:id`.
- Public sets (§4.6): `GET /sets/public` (list every user set — all of them, since none are private in v1 — paginated via `page`/`limit`, reusing the same DTO as `GET /catalog`, §3), `GET /sets/public/:id` (detail + coin list, unauthenticated). No owner-restriction on read; write endpoints above stay owner-only.
- Seed templates: write 1–2 real files under `seed/templates/` using the Week 1 fixtures (e.g. a year-range set and a second smaller set to prove the multi-template pipeline), build the admin seed script (§4.4) — resolves each entry against the catalog already imported in Week 1, no runtime external call — run it, confirm `canonical_sets` populates correctly with `position` set on each slot.
- Collection/ownership module: `PATCH /collection/:coinId` with an explicit `{ owned: boolean }` body (idempotent, not a toggle — §3), `GET /collection` (filterable), `GET /sets/:id/gaps` (join + completion %, computed against the caller's own ownership rows regardless of who owns the set — works on public sets too, not just the caller's own, §4.6).
- Manual pass specifically for the public-set flow: register two throwaway users, have user A create and populate a set (public by default), confirm user B can `GET /sets/public/:id` it, clone it via `POST /sets`, and see their own gap view against it — then confirm user B gets 403 trying to `PATCH`/`DELETE` user A's original set.
- Manual pass specifically for set-deletion/ownership isolation: mark a coin owned within a set, `DELETE` that set, then confirm via `GET /collection` that the coin still shows owned — catches an accidental `ownership` cascade before it ships (§4.1).
- Manual pass specifically for clone-lineage isolation: have user A create and populate a public set, have user B clone it, then `DELETE` user A's original — confirm user B's clone still exists with its coins intact and `cloned_from_user_set_id` reset to `null`, not deleted along with the source. Confirms the `onDelete: SetNull` FK behavior (§4.1) rather than trusting an unstated Prisma default.
- Manual pass specifically for duplicate-slot prevention: `PATCH /sets/:id/coins` to add the same `coinId` twice in one call, and again as two separate retried calls, then confirm the set's coin count/`GET /sets/:id/gaps` completion % reflects one slot, not two — catches a missing skip-on-conflict before it corrupts completion percentages (§4.1).
- Manual pass specifically for `mint_mark`/`variety` dedup: after the Week 1 import, spot-check a handful of no-mint-mark coins in the DB directly (not through the API) to confirm they're all stored as literal `''` and not a mix of `''`/`null`/other placeholders — catches an import-script sanitization gap before it silently duplicates catalog rows (§4.1, §4.3).
- Finalize shared DTOs/enums in `packages/shared`, including `page`/`limit` pagination params on the catalog query DTO from the start. Confirm both apps import cleanly.
- Small test suite around gap-computation and completion-% logic — it's the one genuinely algorithmic part of the app, cheap to cover, and worth having as a signal in a portfolio repo.
- Manual pass (Postman/curl) over every endpoint in design doc §3 — including confirming anon routes reject writes and auth-required routes reject missing/invalid tokens.

**Checkpoint:** the entire API surface from §3 works end-to-end without any frontend involved, against real imported catalog data (not synthetic fixtures) in the dev DB.

## Week 3: Frontend

- Auth pages: `/login`, `/signup` via the Neon Auth Next.js SDK (or the email/password fallback, if Week 1's spike landed there instead); middleware route protection per design doc §3.1.
- Anonymous routes: `/catalog` (paginated list, per §3's `page`/`limit`), `/catalog/[coinId]`, `/sets/canonical`, `/sets/canonical/[id]`, `/sets/public`, `/sets/public/[id]` (§4.6) — read-only against the already-working API.
- Authenticated routes: `/dashboard`, `/collection`, `/sets/new` (blank, or clone from a canonical or public set), `/sets/[id]` (editor + gap view, owner only for editing).
- Typed `api-client` wired against `packages/shared` DTOs.
- Tailwind styling pass.

**Checkpoint:** full journey works by clicking through the UI — browse anonymously, log in, clone a canonical set, edit it, mark coins owned, see gaps update; separately, confirm a second logged-in user can find the first user's set via `/sets/public`, clone it, and see their own gap view against it.

## Buffer / polish (few days)

- Deploy verification: Render (API) + Vercel (web) against the real Neon instance, not just local dev.
- **Be conscious before going public:** open registration + public-by-default sets + no rate limiting (design doc §5) means "personal use and small-scale testing" is an assumption about who shows up, not something the app enforces — it stops being true the moment the URL is reachable by anyone, not at some later user-count threshold. Not a blocker for shipping, just don't be surprised; revisit rate limiting (design doc §7) if it ever actually needs to be enforced rather than assumed.
- Resolve any still-open items from the PRD/design doc if not already handled.
- **Optional — Numista enrichment:** only if time remains and the open-source catalog has real gaps worth filling. Follow the permission-gated process in design doc §4.3 (email contact@numista.com first, scope by country + denomination, resumable/idempotent import) — not a default v1 task.
- **Optional — publish the open coin dataset:** if the Week 1–2 import produces a clean, reasonably complete open dataset as a byproduct, consider publishing it as its own GitHub repo under the `numismatic-data` topic — a second, reusable portfolio artifact independent of the app itself.
- The `engineering:deploy-checklist` skill covers a structured pre-launch pass if useful once this is close to done.

## Biggest risks to this timeline

- **Open-source catalog data quality** turning out messier than expected — Wikipedia/US Mint lists that are incomplete, inconsistently formatted, or harder to normalize than assumed. Most likely to eat time in Week 1; if it does, the part to descope first is the seed-authoring *tooling* (fall back to one hardcoded canonical set, skipping the general JSON-template pipeline) — not canonical sets themselves, since the PRD's success metric requires a canonical-set-derived set to work end-to-end, and not the core catalog/gap loop.
- **Neon Auth + separate NestJS backend** integration friction, if JWKS verification has undocumented edge cases in practice. This is exactly why Week 1 treats it as a time-boxed spike with a mid-week fallback to email/password rather than an open-ended task — everything downstream (sets, collection) depends on *some* working `AuthGuard`, not specifically on Neon Auth succeeding.