# PRD: Implement the "Coin Collector Companion" design (Classical design system)

**Run:** run_20260728_071525
**Date:** 2026-07-28

## Goal

The Coin Collector Companion web app (apps/web) already has working pages and real backend integration for browsing a coin catalogue, managing personal collecting sets, and authenticating — but its current visual design does not match the newly approved "Classical" design (editorial, hairline-rule, warm-neutral aesthetic imported from a claude.ai/design project). This task restyles and restructures the existing pages' markup to match that design exactly — tokens, layout, copy, and interaction affordances — for the collector using the app, without breaking any existing data-fetching, auth, or business logic. The authoritative design reference is `runs/run_20260728_071525/design-spec.md`.

## User stories

- As a visitor browsing without an account, I want the Home, Catalog, Coin Detail, Canonical Sets, and Public Sets pages to present the catalogue in the new Classical visual style (fonts, colors, spacing, copy) so the app feels like one coherent, finished product.
- As a signed-in collector, I want the Dashboard, Collection, New Set, and Set Editor pages restyled to match the design so my personal collecting data (owned coins, sets, completion percentages) is presented with the same visual language as the public pages.
- As a visitor logging in or signing up, I want the Login/Signup screens restyled to the new centered, minimal Classical layout while keeping real authentication working against the existing API.
- As a collector viewing a canonical or public set, I want the "Clone this set" flow and per-row owned/missing indicators to look and behave as specified in the design (solid accent CTA, correct badge visibility rules) while using my real set/coin data.
- As a developer maintaining this app, I want the existing test suites for each page to still pass (updated for any copy/structure changes required by the new design) so the restyle doesn't regress existing functionality.

## Acceptance criteria

1. Global design tokens (colors, fonts, spacing, radius, shadows) from `design-spec.md`'s "Design tokens" section are applied app-wide: Cormorant Garamond headings (weight 600), IBM Plex Sans body text, IBM Plex Mono for all tabular/numeric text, and the exact `--color-*` palette (background `#f3f2f2`, text `#201f1d`, accent `#b68235`, neutral ramp, divider as a 16%-mixed hairline).
2. The sticky global header matches the spec: brand button → Home, always-visible Catalog/Canonical Sets/Public Sets links, and a divider-separated signed-in group (Dashboard/Collection/Log out) or signed-out group (Log in/Sign up), rendered from the app's real auth state.
3. Home page (`app/page.tsx`) matches the spec's copy, headline, and three catalogue/canonical/public link-rows showing real live counts (not mock numbers).
4. Catalog page (`catalog/page.tsx`) matches the spec's filter row (country, denomination, name/series text, year from/to, clear), row layout (avatar, name, sub, key-date star, owned badge), empty state copy, and pagination style — wired to real catalogue data and existing filter/pagination logic.
5. Coin Detail page (`catalog/[coinId]/page.tsx`) matches the spec's two-column layout, metadata table, owned/missing action button (signed-in) or login prompt (signed-out), and "Appears in your sets" section — using real coin and ownership data.
6. Canonical Sets list (`sets/canonical/page.tsx`) and Canonical Set Detail (`sets/canonical/[id]/page.tsx`) match the spec's copy and layout, including the "Clone this set" solid-accent CTA (signed-in) / login prompt (signed-out) on the detail page.
7. Public Sets list (`sets/public/page.tsx`) and Public Set Detail (`sets/public/[id]/page.tsx`) match the spec's copy and layout, including the "Kept by {author}" byline, pagination, per-row owned/missing badges (signed-in viewers only, per spec), and the "you already own N of M" overlap line (signed-in only).
8. Login (`login/page.tsx`) and Signup (`signup/page.tsx`) pages match the spec's centered narrow layout, copy, and switch-link, while continuing to call the app's real auth API and surface real validation/error states (the design mock's "always succeeds" behavior is explicitly NOT replicated — see PRD Out of scope).
9. Dashboard (`dashboard/page.tsx`) matches the spec's stat tiles (sets/coins-owned/average-completion) and set-row list with progress bars, using the signed-in user's real sets and ownership data.
10. Collection page (`collection/page.tsx`) matches the spec's country/year filters, flat coin-row list, and empty-state copy, using the signed-in user's real owned coins.
11. New Set page (`sets/new/page.tsx`) matches the spec's mode radio group (blank/clone-canonical/clone-public), source picker, catalogue picker with Add, and "in this set" list with Remove, wired to real set-creation logic.
12. Set Editor page (`sets/[id]/page.tsx`) matches the spec's editable inline set name, large completion percentage + progress bar, all/missing-only toggle, decade-grouped accordions with owned/missing row styling, and inline "add coins" picker — using the real set's real coin/ownership data.
13. Every page listed in criteria 3–12 keeps rendering real data from the existing API clients/hooks (`apps/web/src/lib/*.ts`, `apps/web/src/lib/hooks/*.ts`) — no page is rewired to use the design mock's fake in-memory data.
14. Existing test files for the restyled pages (the `*.test.tsx` files already present per the repo digest) are updated as needed to match the new markup/copy and continue to pass; no existing page's underlying behavior (data fetching, auth gating, filter/pagination logic, clone/create/toggle actions) regresses.

## Out of scope

- Rebuilding or changing any backend/API behavior in `apps/api` — this task is UI/markup only.
- Replicating the design mock's fake in-memory auth ("submit always succeeds") — real auth error handling and validation must be preserved/improved, not degraded to match the mock.
- Adding real coin photography — the Coin Detail "plate" stays a placeholder per the design spec's own placeholder treatment (open question 6).
- Making the key-date star visibility a user-facing configurable setting — it stays always-on, matching the design's default.
- Any new backend features, new coin data, or new set types not already present in the existing catalogue/collection data model.

## Open questions

See `design-spec.md`'s "Open questions / ambiguities for the Architect" section for design-level judgment calls (primary-button fill vs. outline, inline SVG vs. Lucide icons, decision already made above for the mock's fake-auth behavior and default landing route — Home stays the real default, not the mock's Set-Editor preview default).
