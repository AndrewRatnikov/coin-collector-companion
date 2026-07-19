# v2 Week 1 Backlog — Backend Foundations (~1 week)

Source: [docs/prd_v2.md](prd_v2.md), [docs/system-design_v2.md](system-design_v2.md), [docs/build-roadmap.md](build-roadmap.md) (Week 1). Scope firewall = the checkpoint at the bottom: if a task isn't needed to get there, it's not this week.

**This is a pivot, not an extension, from the Phase 1 build** ([specs/backlog_phase_1.md](../specs/backlog_phase_1.md), documented in `CLAUDE.md`). The v2 schema (`coins`/`canonical_sets`/`canonical_set_coins`/`user_sets`/`user_set_coins`/`ownership`) replaces the v1 schema (`CollectionSet`/`SetSlot`/`UserSet`/`CoinItem`) wholesale, and auth moves from hand-rolled Passport+JWT to Neon Auth (with hand-rolled JWT kept only as a documented, time-boxed fallback — PRD Risks, SD §4.2). Only the monorepo skeleton, the Neon project itself, the Render/Vercel deploys, and the GitHub Actions CI plumbing carry forward unchanged.

Conventions: no runtime external calls anywhere in the API request path (SD §2.3, §4.3) — the catalog is either in Postgres or it isn't. `mint_mark`/`variety` are `NOT NULL DEFAULT ''`, never `null` or a placeholder string (SD §4.1). Per-coin uniqueness is `(country, denomination, year, mint_mark, variety)` — `numista_type_id` is enrichment only, never part of identity (SD §4.1).

---

## Day 1 AM — Reconcile with the existing build, then the licensing gate

- [ ] 0.1 Decide & record the fate of the existing v1 schema/auth: `CollectionSet`/`SetSlot`/`UserSet`/`CoinItem` and the `AuthModule` (Passport/JWT/bcrypt) are being replaced, not extended. Confirm there's no v1 data worth preserving in the shared Neon dev DB before wiping it — per `CLAUDE.md` this DB is also what Render points at in prod, but it currently holds only throwaway test accounts that were already due for cleanup.
- [ ] 0.2 License/ToS check for the chosen open sources — Wikipedia mintage lists / US Mint publications, Wikimedia Commons images (including per-image license handling on Commons, since it isn't all public domain like the Mint's own imagery) — a day-one gate, not a buffer-week afterthought. Don't start any import code until this is confirmed (PRD Scope & Timeline; SD §4.3).

## Day 1 PM — Real fixtures

- [ ] 1.1 Pull real data from the confirmed source(s) for the initial catalog scope (US cents) and save it as fixtures under `scripts/import-catalog/fixtures/` in the repo — so the schema below gets checked against real data shapes, not assumptions.

## Day 2 — Prisma schema v2 + migration

- [ ] 2.1 Replace `apps/api/prisma/schema.prisma` per SD §4.1: `coins` (`@@unique([country, denomination, year, mintMark, variety])`; `mintMark`/`variety` `NOT NULL` default `''`; `numistaTypeId` nullable, not unique; `name`; `imageUrl`/`imageSource`/`imageLicense` nullable), `canonical_sets` (`name`, `description`, `source`, `templateVersion`), `canonical_set_coins` (`@@unique([canonicalSetId, coinId])`, `position`), `user_sets` (`clonedFromCanonicalId`/`clonedFromUserSetId`, both nullable, both `onDelete: SetNull`), `user_set_coins` (`@@unique([userSetId, coinId])`, `position`, `onDelete: Cascade` on `userSetId` only), `ownership` (composite pk `(userId, coinId)`, `ownedAt`). No `tags`/`coin_tags`, no `sync_log` — both cut, not deferred.
- [ ] 2.2 Run the migration against the Neon dev DB; spot-check via Prisma Studio or `psql` that all six tables exist with the right constraints (especially the composite unique on `coins` and the two `SetNull` FKs on `user_sets`).

## Day 3 → Day 4 AM — Neon Auth spike (time-boxed, ~1.5 days) with a fallback decision

- [ ] 3.1 Wire Neon Auth's SDK into `apps/web` (just enough to mint a real token — no UI polish needed yet); build an `AuthGuard` in `apps/api` that fetches + short-TTL-caches the JWKS endpoint and verifies signature (EdDSA) + issuer, extracting `user_id` (SD §4.2).
- [ ] 3.2 Test the guard end-to-end against a manually issued token (curl/Postman) — confirm a valid token passes, an expired/tampered one 401s, and no token on an anonymous route works with no `user_id` scoping.
- [ ] 3.3 **Decision point, by mid-week:** if JWKS verification isn't working cleanly, stop and fall back to hand-rolled email/password + JWT — the v1 `AuthModule` pattern (bcrypt cost 10, class-validator DTOs, Passport JWT strategy) can be resurrected here rather than designed from scratch, since it already existed and worked under Phase 1. Don't let this spike block Week 2's domain logic, which only needs *some* working `AuthGuard`.

## Day 4 PM — Catalog import script

- [ ] 4.1 Build `scripts/import-catalog`: parse the confirmed source(s) for the US-cents scope, normalize into the `coins` shape, sanitize `mintMark`/`variety` (any of `null`/`undefined`/`"None"`/`"N/A"`/whitespace → the literal `''` before it reaches Prisma), skip (or omit `imageUrl` for) any image whose license isn't public-domain-tagged, upsert deduped on the natural key, resumable + idempotent (SD §4.3).
- [ ] 4.2 Run the script against the Neon dev DB using Day 1's fixtures. Spot-check a handful of no-mint-mark rows directly in the DB (not through the API) to confirm they're all stored as `''`, not a mix of placeholders.

## Day 5 — Catalog endpoints + wrap-up

- [ ] 5.1 `CatalogModule`: `GET /catalog` (filter by country, denomination, name substring, year range; paginated `page`/`limit`; no auth) and `GET /catalog/:id` — serves purely from Postgres, no runtime external call (SD §3, §4.1).
- [ ] 5.2 One-line attribution note in the `apps/web` footer for Wikipedia-derived catalog data (CC BY-SA) — cheap, closes the attribution question outright (SD §4.3).
- [ ] 5.3 Manual pass: `GET /catalog` with a real country+year-range filter returns correct data from the imported fixtures; confirm (via logs or a network check) that no external call fires anywhere in that request path.

---

**Checkpoint:** the import script has loaded real US-cents fixture data into Postgres, and `GET /catalog` with a real filter returns it correctly — with no external call anywhere in the request path. Neon Auth's status is a closed decision (working, or explicitly fallen back to hand-rolled JWT), not still open going into Week 2.

## Explicitly NOT this week (resist)

- Sets/canonical sets/public sets/ownership endpoints — Week 2 (build-roadmap.md)
- Any frontend beyond the footer attribution note and whatever minimal auth wiring the spike itself needs — Week 3
- Numista integration — optional buffer-week item only, permission-gated, not a v1 dependency
- Theme/subject tagging — cut from v1 entirely, not deferred (PRD Requirement 15)
- Drag-and-drop set reordering, `is_public` flag, image re-hosting — all explicitly deferred in SD §4.1/§4.6/§4.3/§7
