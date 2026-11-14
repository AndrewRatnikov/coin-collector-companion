# Growth Backlog: from working demo to something collectors use

Source: project review in chat, 2026-11-13. Andrew asked what to improve and which features would make the project successful, then asked for the answer as a backlog. This doc is a prioritised roadmap, split into sequential steps like [docs/backlog_password-management.md](backlog_password-management.md). Each step is independently shippable and has its own checkpoint.

## Why this came up

The engineering is ahead of the product. The core loop works and is well tested, but the catalog holds about 360 coins (142 Lincoln Wheat cents plus Ukrainian circulation and commemorative coins, per `scripts/import-catalog/fixtures`) and 5 curated sets (`seed/templates`). A collector arriving today most likely can't find their coins. On top of that:

- 22 of 23 pages are `'use client'` with one static title and description (`apps/web/src/app/layout.tsx`), and there is no sitemap, robots file or Open Graph metadata, so public catalog and set pages bring no search traffic.
- The home page (`apps/web/src/app/page.tsx`) is three links with counts, and the first request after idle waits 30-60 seconds on Render's free tier.
- Password-reset email only reaches the Resend account owner, and sign-up has no email verification.
- Local `apps/api/.env` points at the production database, and migrations are applied by hand.
- GitHub CI skips the web tests and both builds; only `.claude/verify.json` runs them.
- No error tracking and no analytics.

## Decision

Order of work: make production safe (Step 0), fix what a first visitor sees (Step 1), widen the catalog (Step 2), make public pages findable (Step 3), then add the features that bring people back and bring new people in (Steps 4-5). Steps 6-7 change PRD non-goals and are parked until the PRD is updated.

**Open question to settle before Step 2:** the PRD's goal is a portfolio piece and personal tool. If that is still the goal, Steps 0-1 plus a written case study finish the project. Steps 2 onward only make sense if the goal becomes real users. Record the answer in `docs/prd_v2.md` (Goals) before starting Step 2.

**PRD conflicts, flagged so they aren't built by accident** (CLAUDE.md "Scope discipline"):

- Step 1.5 (keep the API warm) reverses "cold starts are an accepted trade-off" for Render only; Neon autosuspend stays accepted. Needs a line in the PRD and CLAUDE.md status.
- Step 6 (quantities, notes, purchase price) reverses three PRD non-goals.
- Step 7.1 (Numista export preset) reads a user's own export file and calls no Numista service, but "any Numista dependency" is on the scope firewall, so it needs an explicit PRD decision.
- Step 7.2 (own-coin photos) and 7.3 (theme tags) are on the scope firewall by name.

---

## Step 0: Production safety and visibility

- [ ] 0.1 Create a Neon branch for development and point local `apps/api/.env` at it. Production's `DATABASE_URL` lives only in Render. Update CLAUDE.md "Database safety" and the README warning to match.
- [ ] 0.2 **Pending manual pass:** run `prisma migrate status` against production and apply `20260923200000_add_password_reset_token`, `20260926120000_add_coin_specs` and `20261102200000_add_coin_grades` if any is missing. Re-run the catalog import afterwards (specs, Ukrainian fixtures).
- [ ] 0.3 Run `prisma migrate deploy` as part of the Render deploy (pre-deploy command or the start of `buildCommand` in `render.yaml`), so code can't ship ahead of its migration. Remove the "migrations are not run by the Render build" notes from README and CLAUDE.md once verified.
- [ ] 0.4 `.github/workflows/ci.yml`: add `pnpm --filter web test`, `pnpm --filter api build` and `pnpm --filter web build`, so CI matches `.claude/verify.json`.
- [ ] 0.5 Error tracking (Sentry or similar free tier) in `apps/api` and `apps/web`. No personal data in events beyond the user id.
- [ ] 0.6 Privacy-friendly analytics on the web app (page views plus four events: sign-up, set created, coin marked owned, set cloned). Write an ADR for the provider choice.
- [ ] 0.7 Security headers on the API (`helmet` in `apps/api/src/configure-app.ts`) and a unit test that they are set.
- [ ] 0.8 Verify a sending domain in Resend and close items 3.12-4.3 in `docs/backlog_password-management.md`.
- [ ] 0.9 Email verification on sign-up (token table mirroring `PasswordResetToken`, a verify page, a resend link). Unverified accounts keep working; they see a banner.

**Checkpoint:** a migration can't be forgotten, development can't touch production data, CI catches web regressions, errors and usage are visible, and any user can reset a password.

## Step 1: First impression

- [ ] 1.1 Landing page shows the gap view itself: a read-only demo of one curated set with sample ownership, above the three existing links. No account needed. EN and ES strings together.
- [ ] 1.2 Landing page copy states the one-line pitch ("see what you're still missing") and has a clear sign-up action next to the demo.
- [ ] 1.3 Loading state for a cold API: after about 3 seconds without a response, show "waking the server" text instead of an empty page, on the public pages.
- [ ] 1.4 `<html lang>` is correct on first paint: store the locale in a cookie as well as `localStorage` and read it in `layout.tsx`.
- [ ] 1.5 Keep the API warm on the free plan; leave the database to sleep. **Needs the PRD line noted above.** Checked 2026-11-13 against Render and Neon docs; re-check the limits before building.
  - [ ] 1.5.1 A free external scheduler (cron-job.org, an uptime monitor, or a GitHub Actions `schedule` workflow at `*/10`) requests `GET /api/v1/health` every 10 minutes. Render's free web service sleeps after 15 minutes without inbound traffic.
  - [ ] 1.5.2 Confirm the Render workspace has only this one free web service: 24/7 uses 720-744 of the 750 free instance hours per month, and running out suspends every free service until the next month.
  - [ ] 1.5.3 `GET /health` stays a pure liveness check with no database query (true today in `health.controller.ts`), and a unit test fails if `PrismaService` is injected into `HealthController`. A ping that touches Neon would keep its compute awake and use up the 100 CU-hours (about 400 hours at 0.25 CU) around mid-month.
  - [ ] 1.5.4 Do not warm Neon. Free-plan auto-suspend (5 minutes) can't be turned off, and a resume takes a few hundred milliseconds, which 1.3 already covers.
  - [ ] 1.5.5 After a week, check Render's free-hours usage and Neon's CU-hours in their dashboards and record the numbers in `docs/history.md`.
- [ ] 1.6 Manual browser pass at phone and desktop width, logged out, with a cold API.

**Checkpoint:** a logged-out visitor understands the product and sees a working gap view within a few seconds.

## Step 2: Catalog breadth

Every series passes the license gate in [docs/catalog-data-licensing.md](catalog-data-licensing.md) (US designs from March 1989 onward need a per-design check) and ships with at least one curated set in `seed/templates`.

- [ ] 2.1 Lincoln Memorial cents 1959-2008 and Shield cents 2010 onward.
- [ ] 2.2 Jefferson nickels.
- [ ] 2.3 Roosevelt dimes.
- [ ] 2.4 Washington quarters 1932-1998.
- [ ] 2.5 50 State Quarters, then America the Beautiful quarters.
- [ ] 2.6 Morgan and Peace dollars, with a key-dates set for each.
- [ ] 2.7 Euro circulation coins by country, and the €2 commemoratives.
- [ ] 2.8 Ukrainian UI locale (`locales/uk/`, typed against `en/` like `es/`), since the Ukrainian catalog is already the second largest.
- [ ] 2.9 **Pending manual pass** after each import: run the import and `seed:canonical` against production, spot-check counts and images.

**Checkpoint:** a US or eurozone collector of a mainstream series finds their coins and a ready-made checklist.

## Step 3: Search visibility

Web and API stay separate services. Server components fetch from the API over HTTP; no backend logic moves into Next.js.

- [ ] 3.1 ADR: which public pages render on the server, how they fetch (revalidation interval), and how the client-side ownership layer attaches after hydration.
- [ ] 3.2 Server-render `/catalog/[coinId]` with `generateMetadata` (coin name, year, mint mark in the title; specs in the description).
- [ ] 3.3 Server-render `/sets/canonical` and `/sets/canonical/[id]` with per-set metadata.
- [ ] 3.4 Server-render `/sets/public/[id]` with per-set metadata.
- [ ] 3.5 `sitemap.ts` (coins, curated sets, public sets) and `robots.ts`.
- [ ] 3.6 Open Graph and Twitter card defaults in `layout.tsx`, overridden per page in 3.2-3.4.
- [ ] 3.7 Fix the hydration mismatch noted in `backlog_my-submissions.md` 2.7 (`getStoredToken()` read during render) on the pages touched here.
- [ ] 3.8 Tests: metadata output per page type; sitemap contains only approved coins.

**Checkpoint:** a search for a covered series' checklist can land on a server-rendered page with a real title, description and preview.

## Step 4: Shareable progress

- [ ] 4.1 "Share progress" action on `/sets/[id]`: copies the public set URL. The public page already shows the owner's progress (ADR 2026-11-09).
- [ ] 4.2 Generated preview image for public set pages (set name, percent complete, coins to go) via `opengraph-image`.
- [ ] 4.3 "Start this checklist" action for logged-out visitors on a shared set: sign-up, then clone, in one flow.
- [ ] 4.4 Analytics events for share and for sign-ups that arrive from a shared set.

**Checkpoint:** a collector can post their progress, and a visitor who clicks through can start the same checklist in one flow.

## Step 5: Want list for shows and shops

- [ ] 5.1 Web app manifest and icons so the app installs to a phone home screen.
- [ ] 5.2 Offline read access to the missing-coins page (`/sets/[id]/missing`) for sets the user has opened: cache the last response and show its date.
- [ ] 5.3 One combined want list across all of the user's sets, deduplicated by coin, with the existing print and CSV export.
- [ ] 5.4 Mark a coin owned while offline; sync on reconnect (queue on top of the optimistic ownership hook). Cut this first if the step runs long.
- [ ] 5.5 Manual pass on a phone in airplane mode.

**Checkpoint:** a collector at a dealer's table can open their want list with no signal.

## Step 6: Quantities, notes and cost (parked: needs a PRD change)

- [ ] 6.1 PRD update: remove "no duplicate tracking" and "no per-coin notes" from Non-Goals and define the rules (gap logic stays "owned at least one").
- [ ] 6.2 Migration: `Ownership.quantity` (default 1), `note`, `pricePaid`, `acquiredAt`. All optional except quantity.
- [ ] 6.3 API and shared types; `PATCH /collection/:coinId` accepts the new fields.
- [ ] 6.4 Web: fields on the coin page ownership panel; a "spares" filter on the Collection page.
- [ ] 6.5 CSV import and export carry the new columns and stay round-trip safe (ADR 2026-11-11).
- [ ] 6.6 Collection total cost on the dashboard.

**Checkpoint:** a collector can record what they paid and which coins they have spare.

## Step 7: Later candidates (parked: each needs a PRD change)

- [ ] 7.1 Numista export preset in the CSV importer (column aliases in `import-aliases.ts` and a fixture from a real export).
- [ ] 7.2 Own-coin photos (storage, moderation, premium candidate).
- [ ] 7.3 Theme tags on public sets for discovery.
- [ ] 7.4 "Find this coin" marketplace links in the gap view. The dealers in [docs/affiliate-programs-research.md](affiliate-programs-research.md) are mostly bullion sellers and a poor fit; revisit once there is traffic to measure.

---

## Explicitly NOT this scope (resist)

- **Marketplace, trading between users, following, comments, profiles.** PRD non-goals stand. "Spares" in Step 6 is a personal filter, not trade matching.
- **Value or price tracking.** No pricing data source passes the licensing rules today. Step 6 records what the user paid, nothing more.
- **Image recognition.**
- **A paid tier or billing.** The PRD trigger (a specific free-tier limit being hit) still applies. Nothing in this backlog costs money; Step 1.5 stays on the free plans.
- **Moving API logic into Next.js** to make Step 3 easier.
- **Rewriting client pages that need a login** (dashboard, collection, set editor) as server components. Step 3 covers public pages only.
