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

Order of work: make production safe (Step 0), fix what a first visitor sees (Step 1), widen the catalog (Step 2), make public pages findable (Step 3), then add the features that bring people back and bring new people in (Steps 4-5) and the ones that keep the gap view accurate and easy to fill (Steps 6-7). Steps 8-10 are parked until the PRD is updated.

**Open question to settle before Step 2:** the PRD's goal is a portfolio piece and personal tool. If that is still the goal, Steps 0-1 plus a written case study finish the project. Steps 2 onward only make sense if the goal becomes real users. Record the answer in `docs/prd_v2.md` (Goals) before starting Step 2.

**PRD conflicts, flagged so they aren't built by accident** (CLAUDE.md "Scope discipline"):

- Step 1.5 (keep the API warm) reverses "cold starts are an accepted trade-off" for Render only; Neon autosuspend stays accepted. Needs a line in the PRD and CLAUDE.md status.
- Step 6 (sets that stay current) adds a stored filter to a set. PRD Requirement 9 only covers building a set from a filter once, so it needs a PRD line.
- Step 7 (import presets) reads a user's own export file and calls no outside service, but "any Numista dependency" is on the scope firewall, so the Numista preset needs an explicit PRD decision. The other presets don't.
- Step 8 (type-set slots) changes the data model rule "a set is a list of coins".
- Step 9 (quantities, notes, purchase price) reverses three PRD non-goals.
- Step 10.1 (theme tags) is on the scope firewall by name.

**Competitor check (2026-11-16):** Steps 4 onward were revised against [docs/competitor-analysis.md](competitor-analysis.md). The test for every feature is the main idea: does it feed coins into the gap view, make the gap view truer to the collector's own goal, or put the gap list in their hands when they need it? Features that fail the test were dropped or demoted (see "Explicitly NOT this scope").

---

## Step 0: Production safety and visibility

- [x] 0.1 Create a Neon branch for development and point local `apps/api/.env` at it. Production's `DATABASE_URL` lives only in Render. Update CLAUDE.md "Database safety" and the README warning to match.
- [x] 0.2 Run `prisma migrate status` against production and apply `20260923200000_add_password_reset_token`, `20260926120000_add_coin_specs` and `20261102200000_add_coin_grades` if any is missing. Done 2026-11-14: 11 migrations found, "Database schema is up to date", nothing to apply.
  - [x] 0.2.1 Confirmed 2026-11-14 on the live site (coin pages show diameter, weight and mintage). Was: confirm the catalog import was re-run after `add_coin_specs` (specs on coin pages, Ukrainian coins present); if not, run `seed:canonical` and the import against production.
- [x] 0.3 Run `prisma migrate deploy` as part of the Render deploy, so code can't ship ahead of its migration. Done 2026-11-15: `render.yaml`'s `buildCommand` runs `pnpm --filter api exec prisma migrate deploy` after `prisma generate` and before the API build (the free plan has no pre-deploy command), README and CLAUDE.md describe it, see the ADR in docs/adr/. Verified on the first real Render deploy: the build log showed 11 migrations found and "No pending migrations to apply", then the API built and went live. Not yet exercised with a real pending migration; if that deploy fails with an advisory-lock timeout (P1002) on Neon's pooled URL, the build needs a direct (non-pooled) URL for the migrate step (follow-up change).
- [x] 0.4 `.github/workflows/ci.yml`: add `pnpm --filter web test`, `pnpm --filter api build` and `pnpm --filter web build`, so CI matches `.claude/verify.json`.
- [x] 0.5 Error tracking (Sentry or similar free tier) in `apps/api` and `apps/web`. No personal data in events beyond the user id. Done 2026-11-18: Sentry SDK 11 in both apps (org `andrew-0p`, projects `coin-collector-api` and `coin-collector-web`), confirmed in production. SDK `dataCollection` turns off user details, cookies, headers, bodies, query strings, database query values and stack-frame variables (`sentry-data-collection.ts` in each app, with a test), and Session Replay masks all text and inputs and blocks media. Both Sentry projects have "Prevent Storing of IP Addresses" on plus an Advanced Data Scrubbing rule that removes `$user.geo.**`, because Sentry otherwise stores a city and country derived from the connection IP. Checked with a live test event carrying an email in the body and query string, a cookie and an `X-Forwarded-For`: none of it, and no IP or location, reached Sentry. The user id is not attached yet (allowed, not required).
- [x] 0.6 Privacy-friendly analytics on the web app (page views plus four events: sign-up, set created, coin marked owned, set cloned). Write an ADR for the provider choice. Done 2026-11-20: PostHog Cloud in cookieless mode through the `/relay` proxy, the four events plus `want_list_exported`, a `/privacy` page, and `apps/api/scripts/retention-report.ts` for week-two retention; see the ADR in docs/adr/.
  - [ ] 0.6.1 Pending manual pass: set the Vercel env vars and the two PostHog project settings, then confirm page views and the events arrive in PostHog from the production site with no cookies or storage written.
- [x] 0.7 Security headers on the API (`helmet` in `apps/api/src/configure-app.ts`) and a unit test that they are set. Done 2026-11-15: helmet 8.3.0 with its defaults in `configureApp`, so `main.ts` and the e2e apps send the same headers; Swagger UI at `/api/docs` checked to load and run "Try it out" under the default CSP, so nothing was relaxed, and credentialed CORS for the web origin still works. Unit tests in `configure-app.spec.ts`, e2e assertion on `GET /api/v1/health`. See the ADR in docs/adr/.
- [ ] 0.8 Verify a sending domain in Resend and close items 3.12-4.3 in `docs/backlog_password-management.md`. Pending manual pass: password reset to a non-owner address, and a session that outlives 15 minutes on coincompanion.app.
- [ ] 0.9 Email verification on sign-up (token table mirroring `PasswordResetToken`, a verify page, a resend link). Unverified accounts keep working; they see a banner.

**Checkpoint:** a migration can't be forgotten, development can't touch production data, CI catches web regressions, errors and usage are visible, and any user can reset a password.

## Step 1: First impression

- [x] 1.1 Landing page shows the gap view itself: a read-only demo of one curated set with sample ownership, above the three existing links. No account needed. EN and ES strings together. Done 2026-11-17: the signed-out `/` shows a static, network-free Lincoln Wheat Cents sample (24 coins, 16 owned; 1909-1912 at phone width) as a gap demo built from `CoinCard`, with a printable want list and CSV download next to it, then the three ways in with live counts, and what's covered (`components/landing/`, `lib/landing/`); the demo ships read-only (variant A), and `interactive` on `LandingHero` switches it to tappable `StatusToggle`s (variant B). EN and ES in `locales/*/landing.ts`. Brief: `docs/design/2026-11-16_landing.md`.
- [x] 1.2 Landing page copy states the one-line pitch ("see what you're still missing") and has a clear sign-up action next to the demo. Done 2026-11-17: the hero's `h1` is "See what you're still missing.", with "Create a free account" (`/signup`) and "Browse checklists" next to the demo; meta description and a static Open Graph/Twitter card (`app/opengraph-image.png`, `app/twitter-image.png`) carry the same pitch.
- [x] 1.3 Loading state for a cold API: after about 3 seconds without a response, show "waking the server" text instead of an empty page, on the public pages. Done 2026-11-17: `useSlowLoading` (3 s) plus `ServerWakingNotice` (`common.serverWaking`) under the loading skeleton of `/catalog`, `/catalog/[coinId]`, `/sets/canonical`, `/sets/canonical/[id]`, `/sets/public`, `/sets/public/[id]`, and under the ways-in counts on `/`; driven by each page's main query only.
- [x] 1.4 `<html lang>` is correct on first paint: store the locale in a cookie as well as `localStorage` and read it in `layout.tsx`. Done 2026-11-17: `setLocale` also writes a `ccc-locale` cookie (one year, `SameSite=Lax`, `lib/i18n/locale-cookie.ts`), an existing `localStorage` choice is copied into it on the next visit, and the async root layout reads it with `cookies()` and passes it to `<html lang>` and `I18nProvider initialLocale`. Every route is now dynamically rendered; see the ADR in docs/adr/.
- [ ] 1.5 Keep the API warm on the free plan; leave the database to sleep. **Needs the PRD line noted above.** Checked 2026-11-13 against Render and Neon docs; re-check the limits before building.
  - [ ] 1.5.1 A free external scheduler (cron-job.org, an uptime monitor, or a GitHub Actions `schedule` workflow at `*/10`) requests `GET /api/v1/health` every 10 minutes. Render's free web service sleeps after 15 minutes without inbound traffic.
  - [ ] 1.5.2 Confirm the Render workspace has only this one free web service: 24/7 uses 720-744 of the 750 free instance hours per month, and running out suspends every free service until the next month.
  - [ ] 1.5.3 `GET /health` stays a pure liveness check with no database query (true today in `health.controller.ts`), and a unit test fails if `PrismaService` is injected into `HealthController`. A ping that touches Neon would keep its compute awake and use up the 100 CU-hours (about 400 hours at 0.25 CU) around mid-month.
  - [ ] 1.5.4 Do not warm Neon. Free-plan auto-suspend (5 minutes) can't be turned off, and a resume takes a few hundred milliseconds, which 1.3 already covers.
  - [ ] 1.5.5 After a week, check Render's free-hours usage and Neon's CU-hours in their dashboards and record the numbers in `docs/history.md`.
- [x] 1.6 Manual browser pass at phone and desktop width, logged out, with a cold API. Pending manual pass (see the checklist in `docs/design/2026-11-16_landing.md`).

**Checkpoint:** a logged-out visitor understands the product and sees a working gap view within a few seconds.

## Step 2: Catalog breadth

Every series passes the license gate in [docs/catalog-data-licensing.md](catalog-data-licensing.md) (images of US designs from March 1989 onward need a per-design check; catalog rows don't) and ships with at least one curated set in `seed/templates`.

- [x] 2.1 Lincoln Memorial cents 1959-2008 and Shield cents 2010 onward. Done 2026-11-21: fixtures (1959-2025, business strikes) and the "Lincoln Memorial and Shield Cents 1959-2025" and "Lincoln Cents 1909-2025" sets. Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.
- [x] 2.2 Jefferson nickels. Done 2026-11-25: fixtures (1938-2025, 194 business strikes, copper-nickel and 1942-1945 wartime silver files) and the "Jefferson Nickels 1938-2026" and "Jefferson Nickel Key Dates" sets (1939-D, 1950-D, as the saved source names them). Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.
- [x] 2.3 Roosevelt dimes. Done 2026-11-25: fixtures (1946-2025, 168 business strikes, silver and clad files) and the "Roosevelt Dimes 1946-2026" set. The 1946-1964 Philadelphia dimes keep the source's plain P; confirm that before the import. Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.
- [x] 2.4 Washington quarters 1932-1998. Done 2026-11-25: fixtures (1932-1998, 146 business strikes, silver and clad files, the 1776-1976 Bicentennial coins as year 1976) and the "Washington Quarters 1932-1998" set. Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.
- [x] 2.5 50 State Quarters, then America the Beautiful quarters. Done 2026-11-21: fixtures for 1999-2026 (P and D business strikes plus the 2019-2020 W quarters, 286 coins) and one canonical set per program: "50 State Quarters", "DC and US Territories Quarters", "America the Beautiful Quarters", "Washington Crossing the Delaware Quarter", "American Women Quarters", "Semiquincentennial Quarters". Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.
- [ ] 2.6 Morgan and Peace dollars, with a key-dates set for each.
- [ ] 2.7 Euro circulation coins by country, and the €2 commemoratives.
- [ ] 2.8 Ukrainian UI locale (`locales/uk/`, typed against `en/` like `es/`), since the Ukrainian catalog is already the second largest.
- [ ] 2.9 **Pending manual pass** after each import: run the import and `seed:canonical` against production, spot-check counts and images.
- [x] 2.10 Modern US dollars: Presidential, Sacagawea and Native American, American Innovation, Eisenhower, Susan B. Anthony. Done 2026-11-24: fixtures for the five programs (227 business strikes: Presidential 2007-2016 and 2020, Sacagawea and Native American 2000-2026, American Innovation 2018-2026, Eisenhower 1971-1978, Susan B. Anthony 1979-1981 and 1999) and one canonical set per program: "Presidential Dollars 2007-2020", "Sacagawea and Native American Dollars", "American Innovation Dollars", "Eisenhower Dollars", "Susan B. Anthony Dollars". Not yet in production: the import and `seed:canonical` are the pending manual pass under 2.9.

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

The registries show that collectors want to show a set and its progress; this is the version for uncertified coins.

- [ ] 4.1 "Share progress" action on `/sets/[id]`: copies the public set URL. The public page already shows the owner's progress (ADR 2026-11-09).
- [ ] 4.2 Generated preview image for public set pages (set name, percent complete, coins to go) via `opengraph-image`.
- [ ] 4.3 "Start this checklist" action for logged-out visitors on a shared set: sign-up, then clone, in one flow.
- [ ] 4.4 Public sets list can be sorted by number of clones, so good checklists surface.
- [ ] 4.5 Analytics events for share and for sign-ups that arrive from a shared set.

**Checkpoint:** a collector can post their progress, and a visitor who clicks through can start the same checklist in one flow.

## Step 5: Want list for shows and shops

Raised in priority after the competitor check: a year-and-mint-mark want list is what users of the big catalogues ask for and build by hand today. If Steps 3 and 5 compete for time, do 5.1-5.4 first.

- [x] 5.1 Missing-coins page (`/sets/[id]/missing`) groups by denomination and year with mint marks on one line (for example "1914: D, S"), so it reads like a show list. Print and CSV follow the same order. Done 2026-11-19: the page is a "Want list" grouped by (country, denomination) then year through the shared `WantListTable` (the landing sample uses it too), with Print and Download CSV; the CSV follows the page order and gains `Want,Grade,Target grade` columns (backlog_want-list.md Phase 1). 390px and print preview are a pending manual pass.
- [x] 5.2 When the set has a minimum grade, the want list gets a second section, "Upgrade wanted", listing owned coins below it with their current grade. Check first what the page shows today for those coins. Done 2026-11-19: before this, owned coins below the minimum appeared nowhere on the page (it listed unowned coins only); they now show under "Upgrade wanted" as e.g. "D (F → VF)", and in the CSV as `upgrade` rows after the missing ones.
- [x] 5.3 One combined want list across all of the user's sets, deduplicated by coin, with the same grouping, print and CSV export. Done 2026-11-20: `/want-list` lists every coin missing from any of the user's sets once (deduplicated by coin, server-side `GET /sets/wants`), plus an "Upgrade wanted" section for owned coins below a set's minimum grade, with a "Which sets?" disclosure, Print and a CSV with a final `Sets` column; the dashboard tile links to it. Live manual pass pending as want-list 3.7.
- [ ] 5.4 Web app manifest and icons so the app installs to a phone home screen, and offline read access to the want lists the user has opened (cache the last response and show its date).
- [ ] 5.5 Mark a coin owned while offline; sync on reconnect (queue on top of the optimistic ownership hook). Cut this first if the step runs long.
- [ ] 5.6 Manual pass on a phone in airplane mode.

**Checkpoint:** a collector at a dealer's table can open a compact list of what they need and what they want to upgrade, with no signal.

## Step 6: Sets that stay current (needs a PRD line)

A set built from a catalogue filter is a snapshot. When the catalogue grows (new year issues, a newly imported series, an approved submission), the set silently falls behind and the gap view under-reports.

- [ ] 6.1 PRD and system design update: a set may remember the filter it was built from. The set's coin list stays explicit; nothing is added without the owner's action.
- [ ] 6.2 Migration and API: optional stored filter on `UserSet` (country, denomination, name, year range), saved when a set is created from a filter. Clones do not inherit it.
- [ ] 6.3 `GET /sets/:id` reports how many approved catalogue coins match the stored filter but are not in the set.
- [ ] 6.4 Set page: a notice "N new coins match this set" with review and add, or dismiss. Dismissed coins are not offered again.
- [ ] 6.5 Same notice for sets cloned from a curated checklist when the checklist's template version gains coins.
- [ ] 6.6 Tests: unit, e2e for the count, component test for the notice. EN and ES strings.

**Checkpoint:** when the catalogue gains coins that belong in a collector's set, the set page tells them, and the gap view stays true.

## Step 7: Import from other tools (Numista preset needs a PRD decision)

Collectors already keep years of data elsewhere. Import is how they try the gap view without retyping.

- [ ] 7.1 Collect one real export file from each source as a test fixture: a generic spreadsheet, OpenNumismat, Colnect, uCoin, Numista. Record each file's licence and origin next to the fixture.
- [ ] 7.2 Source presets in the importer: picking a source pre-fills the column mapping (`import-aliases.ts`, `column-mapping.ts`). The preview-then-confirm flow is unchanged (ADR 2026-10-05).
- [ ] 7.3 Unmatched rows can be exported as CSV, so the user knows what the catalogue is missing, and each one links to "submit this coin".
- [ ] 7.4 After confirm, suggest curated checklists that the imported coins already partly fill ("you own 38 of 142 Lincoln Wheat cents").
- [ ] 7.5 Tests per preset against its fixture.

**Checkpoint:** a collector with an existing list elsewhere gets it in, sees which checklists they have already started, and knows exactly which coins didn't match.

## Step 8: Type-set slots (parked: needs a PRD change)

Type collecting (one example of each design, any year) is a mainstream goal that an explicit coin list can't express.

- [ ] 8.1 PRD and system design update: a set slot may be satisfied by any one of several coins. Define how completion, the want list and minimum grade behave for such a slot.
- [ ] 8.2 Data model, API and gap query.
- [ ] 8.3 Set editor: group selected coins into one slot; album and list views show the slot once.
- [ ] 8.4 One curated type set as the reference case.

**Checkpoint:** a collector can track "one of each" and the gap view counts a slot as filled by any qualifying coin.

## Step 9: Quantities, notes and cost (parked, lowest priority: needs a PRD change)

Demoted after the competitor check. This is inventory-manager territory, well served by other tools, and it does not change what is missing. Build only if users ask.

- [ ] 9.1 PRD update: remove "no duplicate tracking" and "no per-coin notes" from Non-Goals and define the rules (gap logic stays "owned at least one").
- [ ] 9.2 Migration: `Ownership.quantity` (default 1), `note`, `pricePaid`, `acquiredAt`. All optional except quantity.
- [ ] 9.3 API and shared types; `PATCH /collection/:coinId` accepts the new fields.
- [ ] 9.4 Web: fields on the coin page ownership panel; a "spares" filter on the Collection page.
- [ ] 9.5 CSV import and export carry the new columns and stay round-trip safe (ADR 2026-11-11).

**Checkpoint:** a collector can record what they paid and which coins they have spare.

## Step 10: Later candidates (parked)

- [ ] 10.1 Theme tags on public sets for discovery (needs a PRD change).
- [ ] 10.2 "Find this coin" marketplace links in the gap view. The dealers in [docs/affiliate-programs-research.md](affiliate-programs-research.md) are mostly bullion sellers and a poor fit; revisit once there is traffic to measure.

---

## Explicitly NOT this scope (resist)

- **Marketplace, swap matching, following, comments, profiles.** PRD non-goals stand, and these are other products' core with networks this project doesn't have. "Spares" in Step 9 is a personal filter, not trade matching.
- **Photo identification of coins.** A crowded category of phone apps.
- **Rankings and leaderboards.** The grading-service registries own this.
- **Own-coin photos.** Removed from the backlog after the competitor check: storage and moderation cost for an inventory feature.
- **Value or price tracking.** No pricing data source passes the licensing rules today. Step 9 records what the user paid, nothing more.
- **A paid tier or billing.** The PRD trigger (a specific free-tier limit being hit) still applies. Nothing in this backlog costs money; Step 1.5 stays on the free plans.
- **Moving API logic into Next.js** to make Step 3 easier.
- **Rewriting client pages that need a login** (dashboard, collection, set editor) as server components. Step 3 covers public pages only.
