# v2 Week 1 Backlog — Backend Foundations (~1 week)

Source: [docs/prd_v2.md](prd_v2.md), [docs/system-design_v2.md](system-design_v2.md), [docs/build-roadmap.md](build-roadmap.md) (Week 1). Scope firewall = the checkpoint at the bottom: if a task isn't needed to get there, it's not this week.

**This is a pivot, not an extension, from the Phase 1 build** ([specs/backlog_phase_1.md](../specs/backlog_phase_1.md), documented in `CLAUDE.md`). The v2 schema (`coins`/`canonical_sets`/`canonical_set_coins`/`user_sets`/`user_set_coins`/`ownership`) replaces the v1 schema (`CollectionSet`/`SetSlot`/`UserSet`/`CoinItem`) wholesale. Auth was originally planned to move to Neon Auth (with hand-rolled JWT as a time-boxed fallback), but Neon Auth's Beta status led to skipping that spike entirely and restoring the v1 hand-rolled Passport+JWT module directly instead (PRD Risks, SD §4.2) — the `users` table is therefore part of the v2 schema too, not something Neon Auth owns externally. Only the monorepo skeleton, the Neon project itself, the Render/Vercel deploys, and the GitHub Actions CI plumbing carry forward unchanged.

Conventions: no runtime external calls anywhere in the API request path (SD §2.3, §4.3) — the catalog is either in Postgres or it isn't. `mint_mark`/`variety` are `NOT NULL DEFAULT ''`, never `null` or a placeholder string (SD §4.1). Per-coin uniqueness is `(country, denomination, year, mint_mark, variety)` — `numista_type_id` is enrichment only, never part of identity (SD §4.1).

---

## Day 1 AM — Reconcile with the existing build, then the licensing gate

- [x] 0.1 Decide & record the fate of the existing v1 schema/auth: `CollectionSet`/`SetSlot`/`UserSet`/`CoinItem` and the `AuthModule` (Passport/JWT/bcrypt) are being replaced, not extended. Confirm there's no v1 data worth preserving in the shared Neon dev DB before wiping it — per `CLAUDE.md` this DB is also what Render points at in prod. Decision recorded in `CLAUDE.md`'s Architecture section; DB content confirmed directly (not just assumed) during the 2026-07-19 auth restore — one real account beyond the seed templates, confirmed disposable, tables actually dropped via that session's migration. See `CLAUDE.md`'s "v2 rebuild, auth restored" changelog entry for the full record.
- [ ] 0.2 License/ToS check for the chosen open sources — Wikipedia mintage lists / US Mint publications, Wikimedia Commons images (including per-image license handling on Commons, since it isn't all public domain like the Mint's own imagery) — a day-one gate, not a buffer-week afterthought. Don't start any import code until this is confirmed (PRD Scope & Timeline; SD §4.3).

## Day 1 PM — Real fixtures

- [ ] 1.1 Pull real data from the confirmed source(s) for the initial catalog scope (US cents) and save it as fixtures under `scripts/import-catalog/fixtures/` in the repo — so the schema below gets checked against real data shapes, not assumptions.

## Day 2 — Prisma schema v2 + migration

- [ ] 2.1 Replace `apps/api/prisma/schema.prisma` per SD §4.1: `coins` (`@@unique([country, denomination, year, mintMark, variety])`; `mintMark`/`variety` `NOT NULL` default `''`; `numistaTypeId` nullable, not unique; `name`; `imageUrl`/`imageSource`/`imageLicense` nullable), `canonical_sets` (`name`, `description`, `source`, `templateVersion`), `canonical_set_coins` (`@@unique([canonicalSetId, coinId])`, `position`), `user_sets` (`clonedFromCanonicalId`/`clonedFromUserSetId`, both nullable, both `onDelete: SetNull`), `user_set_coins` (`@@unique([userSetId, coinId])`, `position`, `onDelete: Cascade` on `userSetId` only), `ownership` (composite pk `(userId, coinId)`, `ownedAt`). No `tags`/`coin_tags`, no `sync_log` — both cut, not deferred.
- [ ] 2.2 Run the migration against the Neon dev DB; spot-check via Prisma Studio or `psql` that all six tables exist with the right constraints (especially the composite unique on `coins` and the two `SetNull` FKs on `user_sets`).

## Day 3 → Day 4 AM — Auth: hand-rolled JWT, restored directly (spike skipped)

Neon Auth turned out to still be in Beta, so the originally-planned time-boxed JWKS spike (and its mid-week fallback decision) was skipped outright — went straight to hand-rolled email/password + JWT since that exact module already existed and worked under v1 (`CLAUDE.md` backlog 2.1–2.5).

- [x] 3.1 Add a minimal `User` model back to `apps/api/prisma/schema.prisma` (`id`, `email` unique, `passwordHash`, `createdAt` — no relations yet, `user_sets`/`ownership` don't exist until Day 2) and migrate the Neon dev DB. This also closed out the outstanding half of task 0.1: confirmed live (`psql` row counts) the only non-seed-template v1 data was one manual test account (`test@mail.com`, 2 sets, 1 coin) — confirmed disposable, migration applied, `CollectionSet`/`SetSlot`/`UserSet`/`CoinItem` dropped, `User` preserved as-is (shape already matched). Recover `apps/api/src/auth/*` and `test/auth.e2e-spec.ts` from git history (`git show 4c7795a~1:<path>`) — verbatim, no adaptation needed since none of it touched the v1-only relations being dropped. Wire `AuthModule` + `JwtAuthGuard` into `AppModule` (`ThrottlerGuard` → `JwtAuthGuard` order, same as v1). Re-add `@nestjs/jwt`/`@nestjs/passport`/`bcrypt`/`passport`/`passport-jwt` (+ `@types/*`) to `apps/api/package.json` and `bcrypt: true` to `pnpm-workspace.yaml`'s `allowBuilds`.
- [x] 3.2 Tested end-to-end against the real Neon dev DB: `pnpm --filter api test:e2e` (register → login → guarded route 401 without token / 200 with it → wrong-password 401) plus a live curl pass (register, login, wrong-password 401, anonymous `/health` still 200). One bug caught in the process: `HealthController`'s `GET /health` wasn't marked `@Public()` in the post-cleanup stub (there was no guard active when it was written) — restored the `@Public()` decorator from v1, confirmed via the previously-failing then-passing e2e suite.
- [x] 3.3 Decision recorded (no longer conditional): hand-rolled JWT, not Neon Auth — see `CLAUDE.md` Architecture section and `docs/prd_v2.md`/`docs/system-design_v2.md` §4.2 for the full rationale (Beta status + an already-proven implementation vs. Neon Auth's "no extra service to run" appeal).

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
