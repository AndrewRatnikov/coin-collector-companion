# Coin Collector Companion — PRD

**Author:** Andrew Ratnikov | **Date:** 2026-07-19 | **Status:** Draft

## Problem & Context

Existing coin-collecting apps force a collector into one of three shapes: a flat "what I own" list with no structure, a fixed year-based collection view (open it and you see a wall of gaps with no way to scope it down), or a small set of canonical sets (e.g. US Presidents) that someone else defined. None of them let a collector define an arbitrary set on their own terms — for example "1 US cent, 1980–2020" or "coins from different countries that depict animals" — and then track exactly which pieces of that self-defined set are missing.

Andrew hit this gap directly while collecting and is building the tool he wishes existed, using it as a portfolio piece (he's a front-end developer) alongside solving his own problem.

## Goals

- Ship a feature-complete demo of the core loop: build a custom set, populate it with coins, mark coins owned/not-owned, and see gaps and progress against that set.
- Soft target: a working v1 within a few weeks.
- Reuse the existing pnpm monorepo (NestJS/Neon API, Next.js/Tailwind web) already in progress rather than starting over.

## Non-Goals

- No marketplace, buying/selling, or trading between users.
- No deeper social layer — no following collectors, no dedicated public profile pages, no comments/likes/activity feeds. (This is not "no sharing": user-created sets themselves are public and cloneable by default in v1 — see Requirement 18 — the cut is about not building social features on top of that, not about sets being private.)
- No image recognition / scan-to-identify.
- No per-coin notes (condition, purchase price, provenance) in v1.
- No duplicate tracking (owning multiple of the same coin).
- No grading/condition fields (PCGS/NGC style grades).
- No premium/paid tier in v1 — noted as a future direction once free-tier infra limits (Neon/Render/Vercel free tiers) are approached, not a v1 requirement. See "v2 / Post-MVP Direction" below for the current thinking, captured now specifically so it isn't lost, not because any of it is scheduled.

## Target Users & Use Cases

**Primary user (v1): Andrew**, as a collector, using the app to replace ad-hoc tracking of his own coin sets. Architected so it can open up to other collectors later, but v1 is single-real-user in practice.

**Use cases:**

1. **Anonymous visitor** — comes to the site without an account, browses the coin catalog (by country, by year), and browses canonical sets (e.g. US Presidents, US pennies by year) to see what's available. Read-only; no ability to track ownership.
2. **Logged-in collector building a custom set** — wants "1 US cent from 1980 to 2020": filters the catalog by denomination + country + year range, adds the matching coins to a new set, and can keep editing that set's contents later.
3. **Logged-in collector discovering another user's public set** — browses sets other users have created (public by default in v1), finds one matching an interest — e.g. someone else's hand-picked "coins from different countries with animals on them" set — and clones it into their own collection to track independently.
4. **Logged-in collector starting from a canonical set** — clones a pre-built canonical set (e.g. US Presidents) into their own collection, then adds or removes individual coins to make it their own.
5. **Logged-in collector tracking progress** — opens one of their sets, marks coins as owned/not-owned, and sees the gap list (what's missing) and completion percentage update.
6. **Logged-in collector reviewing their overall collection** — sees their full collection across all sets, filterable by country and year.

## Requirements

### Functional

**Anonymous access:**
1. Any visitor can browse the coin catalog without logging in.
2. Any visitor can view canonical sets and year-based sets (read-only, no ownership tracking).

**Authenticated access:**
3. Users can log in / create an account.
4. Logged-in users can add coins to their personal collection.
5. Logged-in users can view their full collection, filterable by country and by year.
6. Logged-in users can view a list of their own sets.
7. Logged-in users can create a new custom set.
8. Logged-in users can edit an existing set (add/remove coins) at any time, including sets cloned from a canonical set or from another user's public set.

**Set building:**
9. Users can build a set by filtering the catalog by year range, country, denomination, and coin name (e.g. "1 US cent, 1980–2020"). For MVP, this filter is a plain form (country, denomination, coin name, year range) — not a live/autocomplete search (see System Design §3.1).
10. Users can manually search and add individual coins to a set regardless of filter.
11. Users can clone a canonical set as the starting point for their own set, then customize it.

**Gap tracking:**
12. Within any of the user's sets, each coin slot shows an owned/not-owned status, computed from a single ownership record per `(user, coin)` — global to the user, not scoped to a set. The same coin shows the same status in every set it appears in.
13. Users can toggle a coin's owned status from within any set view; the update is applied globally for that user (per requirement 12), not just within that set — a coin marked owned in one set immediately shows owned everywhere else it appears too.
14. Each set shows a gap list (coins not yet marked owned) and a completion percentage.

**Catalog & canonical sets:**
15. The coin catalog stores, per coin: year, country, denomination, mint mark/variety, name/series (e.g. "Lincoln Wheat Cent," "Morgan Dollar" — this is what Requirement 9's coin-name filter matches against, see System Design §4.1), and an image. No theme/subject tags in v1 (see Risks & Open Questions).
16. Catalog data for v1 is sourced from open data — Wikipedia mintage lists / US Mint publications for U.S. coin data, Wikimedia Commons for images (U.S. Mint images are public domain) — imported into the app's own database (Neon) via an offline script, not fetched live at request time. Numista is demoted to an optional future enrichment layer, not a v1 dependency (see System Design §4.3); the schema's nullable `numista_type_id` column leaves room for it without committing to it now.
17. Canonical sets (e.g. US Presidents, year-based national coin sets) are pre-curated by an admin/maintainer, not user-generated, and are visible to all users (including anonymous visitors). Canonical sets are required by the Success Metrics below and are not eligible for descoping — if time runs short, descope the seed-authoring tooling instead (see Scope & Timeline).

**Sharing & discovery:**
18. All user-created sets are public by default — any user, including anonymous visitors (read-only), can view another user's set and its coin list; logged-in users can clone it into their own collection the same way they'd clone a canonical set (Requirement 11). There is no per-set privacy control in v1 — see Risks & Open Questions for the planned post-MVP `is_public` flag.

### Non-Functional

- **Stack:** pnpm monorepo, NestJS + Neon (Postgres) API deployed on Render, Next.js + Tailwind web deployed on Vercel, TypeScript throughout. Build on the existing monorepo already in progress.
- **Scale:** designed for personal use and small-scale testing — comfortably within free tiers of Neon, Render, and Vercel, not for real multi-tenant load.
- **Auth:** required to distinguish anonymous (browse-only) from logged-in (collection/set management) access. Decision: Neon Auth (see System Design §4.2). Not yet validated end-to-end — Build Roadmap Week 1 treats it as a time-boxed spike with a fallback to hand-rolled email/password + JWT if JWKS verification isn't working by the spike's time-box.

## Success Metrics

- The core loop — create/edit a set, add coins, mark owned/not-owned, view gaps and completion % — works end-to-end without bugs, for both a filter-built set and a canonical-set-derived set.
- Ship counts as success even before Andrew has fully migrated his real collection into the app; correctness and completeness of the flow is the bar, not adoption.

## Scope & Timeline

- **Soft target:** v1 within a few weeks.
- **In scope for v1:** everything listed under Requirements above.
- **Explicitly deferred:** premium tier / monetization (only relevant once free-tier infra limits are approached), theme/subject tagging, a deeper social layer (following, public profiles, comments — not "sharing," which is in v1 by default per Requirement 18), marketplace, image recognition, notes, duplicates, grading.
- **Not eligible for descoping:** canonical sets — the Success Metrics above require a canonical-set-derived set to complete the core loop end-to-end, same as a filter-built set. If Week 1's catalog work runs long, the part to cut first is the seed-authoring *tooling* (import breadth, multiple templates), not canonical sets themselves — fall back to one hardcoded canonical set, which is enough to preserve the clone flow the success metric depends on.
- **Dependency:** open data sources for the v1 catalog seed — Wikipedia mintage lists / US Mint publications, Wikimedia Commons images — with license/ToS confirmed on day one of the build (see Build Roadmap), not deferred to a buffer week. Numista is an optional future enrichment layer, not a v1 dependency (see Risks below).

## Risks & Open Questions

- **Auth mechanism: decided, not yet validated.** Neon Auth (see System Design §4.2). Build Roadmap Week 1 runs this as a time-boxed spike with an explicit mid-week decision point — fall back to hand-rolled email/password + JWT if JWKS verification isn't working by then, rather than losing more time to it.
- **Catalog sync strategy: decided.** No runtime external calls. v1 catalog data is populated by a one-off, offline, resumable/idempotent import script from open sources (Wikipedia mintage lists / US Mint publications, Wikimedia Commons images) — see System Design §4.3. `GET /catalog` serves purely from Postgres.
- **Numista licensing/ToS.** Resolved for v1 by not depending on Numista at all — the open-source strategy above avoids their extraction restrictions entirely. If Numista is pursued later as an enrichment layer, their ToS prohibits substantial extraction, so that would require: emailing contact@numista.com for permission first, scoping imports by country + denomination (not whole countries, starting with US cents at ~50–100 requests), and a resumable/idempotent import script so re-runs don't waste quota. Also worth checking OpenNumismat's downloadable SQLite catalogs as a possible ready-made seed (email the author about non-private use first) before spending Numista quota on data that already exists elsewhere.
- **Mint mark / variety data modeling.** Resolved — see System Design §4.1: `numista_type_id` is renamed from the earlier `numista_id` and dropped from the uniqueness constraint entirely (it's an enrichment attribute, not identity, and one Numista type spans many years besides). Per-coin uniqueness is enforced by the DB on `(country, denomination, year, mint_mark, variety)`, with `mint_mark`/`variety` made `NOT NULL` (default `''`) so the constraint can't be silently defeated by `NULL`s.
- **Theme/subject tagging: cut from v1 entirely, not just deferred to a manual process.** An earlier draft scoped this as a catalog dimension (filter/browse by tag like "animals"), but none of the open sources carry subject metadata, and it isn't needed for either Success Metrics path (filter-built or canonical-set-derived). `coins` has no tag columns/tables in v1 — a themed set like "coins that depict animals" is still buildable in v1, just via manual pick (Requirement 10) or by cloning another user's hand-built set (Requirement 18), not via a tag filter. Revisit post-MVP if theme-based discovery proves worth the schema/UI cost; Wikidata's "depicts" property is worth exploring then as a possible automated tag source.
- **Set visibility: public by default for v1, no per-set control.** All user-created sets are visible to any user and cloneable, using the same clone mechanism as canonical sets (Requirement 18). Post-MVP: add an `is_public` boolean to `user_sets`, defaulting existing rows to `true` so current behavior doesn't change, letting a user mark an individual set private. Deferred deliberately — it adds a permission check with no real payoff at v1's target scale (personal use and small-scale testing, effectively one real user).

## v2 / Post-MVP Direction

Captured now so it isn't lost, not because any of it is scheduled or committed — none of this is a v1 requirement, and nothing below should influence a v1 scope decision. Revisit this section once v1 has real usage to learn from, not before.

**Monetization: a free/premium split, gated by evidence of demand, not by launch date.**

| Feature area | Free (v1 scope, stays free) | Premium (candidate) |
|---|---|---|
| Custom sets | Capped — e.g. 3–5 custom sets per user | Unlimited custom sets |
| Coin images | Catalog reference images only (hotlinked, §4.3 of System Design) | User-uploaded photos of the collector's actual coins (Cloudflare R2 — the same storage already earmarked for Phase 3's `CoinItem.imageUrls` in the original Phase 1 build, per `CLAUDE.md`) |
| Catalog scopes | Simple filters — country, denomination, coin name, year range (Requirement 9) | Deeper analytics — dynamic value/market tracking, metal-content breakdowns (e.g. "your collection contains 4.2oz of pure silver"), progress charts over time |

The analytics row isn't free to build on today's schema — `coins` (System Design §4.1) has no value, metal-composition, or weight fields, and none of that data is in the v1 open-source import scope (§4.3). Treat it as a distinct future data-sourcing problem, not a UI feature to bolt onto existing catalog data; don't let its presence here imply the schema already supports it.

**The data-import trap is the real moat.** A collector with 500 coins already tracked in a spreadsheet or Numista won't switch if onboarding means retyping all 500 by hand through the v1 add-coin form. The first major post-MVP feature — ahead of most other premium ideas — should be a CSV/Numista-export importer for a user's *own* collection. This is a different integration than the catalog-enrichment Numista use already scoped in System Design §4.3 (bulk catalog data, permission-gated, admin-run): this would be user-triggered, per-account, and reading a personal export rather than scraping the shared database — worth designing separately when it's actually built, not assumed to reuse the same permission/quota constraints.

**Custom themed sets are the growth lever, not just a feature.** Pre-curated canonical sets ("US Cents 1909–1958") are table stakes; a collector's own curation ("coins depicting ships," "silver coins of the 1940s") is what's actually worth showing off. This is exactly what Requirement 18's public-by-default sets (System Design §4.6) already sets up — discovery and cloning of other users' sets is the v1 foundation this growth idea would build on, not a separate system. If this direction firms up, theme/subject tags (cut from v1 per the Risk above) would likely resurface here as a discovery mechanism — browsing public sets by theme — rather than as a catalog-filter feature, which is a different use case than what was cut.

**Keep infrastructure at $0 until the free tier is actually the constraint.** Neon, Render, and Vercel free tiers keep v1's operating cost at zero through the validation phase (System Design §5). Don't introduce a paid tier as a launch-day feature or on a calendar — the trigger is real usage pushing against a specific free-tier limit (row count, compute hours, bandwidth), not a monetization roadmap. Let user demand fund the infrastructure upgrade it causes, rather than building billing infrastructure speculatively ahead of it.