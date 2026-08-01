# PRD: Static Glossary Page

**Run:** run_20260801_142634
**Date:** 2026-08-01

## Goal

Coin-collecting vocabulary already appears throughout the app (mint mark, variety, denomination, canonical/user/public sets, ownership, gap view, completion percentage) but is never explained in-app — a first-time or anonymous visitor has no way to learn what any of it means without leaving the site. This adds a single static, unauthenticated `/glossary` route in `apps/web` that defines both app-specific terms and a handful of general numismatic terms, in the user's selected locale, at zero backend/DB cost (a plain TS data file + existing i18n dictionaries, consistent with the app's current no-CMS, no-markdown-dependency approach).

## User stories

- As an anonymous or logged-in visitor unfamiliar with coin-collecting terms, I want to open a glossary page from the main nav so that I can look up what a term like "mint mark" or "gap view" means without leaving the app.
- As a Spanish-locale user, I want the glossary's terms and definitions to appear in Spanish so that the page is consistent with the rest of the app's localization.
- As a visitor browsing any page, I want a `/glossary` link always visible in the nav (same tier as Catalog/Canonical Sets/Public Sets) so that I can reach it regardless of whether I'm logged in.

## Acceptance criteria

1. Navigating to `/glossary` (anonymously, no auth) renders a page listing coin-collecting terms with definitions — no login redirect, no console errors.
2. The term list includes, at minimum, the app-grounded terms named in `docs/backlog_glossary.md`'s Decision section: canonical set, cloning a set, completion percentage, country, denomination, gap view, mint mark, ownership, public set, user set, variety.
3. The term list includes, at minimum, the general numismatic terms named in the same section: grade, key date, mintage, numismatics, obverse, patina, proof, reverse, uncirculated.
4. Every term label and definition is sourced from `apps/web/src/lib/i18n` dictionaries (`en.ts`/`es.ts`) via `useTranslation()` — no hardcoded English strings in the page/component.
5. `site-nav.tsx` has a `/glossary` link with `data-testid="site-nav-glossary-link"`, positioned in the always-visible group (alongside Home/Catalog/Canonical Sets/Public Sets), reachable from every other page.
6. Switching locale via the existing `LanguageSwitcher` while on `/glossary` re-renders term labels and definitions in the new locale (not just chrome/nav labels).
7. A component test for the glossary page renders and asserts the full term list is present, and that no term/definition falls back to a raw i18n key (i.e., no missing-translation crash or visible `glossary.definition.xxx`-shaped key text).
8. `pnpm --filter web typecheck`, `pnpm --filter web build`, `pnpm --filter web test`, and root `pnpm lint` all pass with the new route/files included.
9. `docs/system-design_v2.md` §3.1's frontend routes table has a `/glossary` row with `Auth: none`, and the route is confirmed excluded from the auth-redirect middleware's protected-route list.

## Out of scope

- An exhaustive numismatics dictionary — capped at roughly the term list already named in the backlog (~20 terms); not a competitor to general coin-terminology references.
- Backend-driven or admin-editable glossary content — no DB table, no CMS, no submission/moderation flow. Content is a static TS data file shipped with the frontend.
- Auto-linking term mentions elsewhere in the app (e.g., turning "mint mark" into a glossary link inside the catalog or forms) — a possible future enhancement, not this task.
- Search or filtering within the glossary page itself.
- Per-coin-type or per-country glossary variants — one single global list.

## Open questions

None — `docs/backlog_glossary.md` fully specifies scope, term list, file locations, and existing conventions to follow (i18n shape, nav pattern, route-tree pattern).
