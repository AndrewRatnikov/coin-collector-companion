# Glossary Page Backlog

Source: discussed in chat 2026-08-01 — Andrew asked whether a page explaining coin-collecting terms is worth adding, given the content is easily looked up on Wikipedia or asked of an AI directly. Decided: build it, scoped deliberately small (static content, no backend, no DB), since it's cheap relative to the core loop and doesn't compete with the app's actual differentiator (the gap view).

## Why this came up

The catalog and set-building flows already surface domain vocabulary without explaining it — `common.mintMark`/`common.variety`/`common.denomination` labels in `en.ts`/`es.ts`, the `submit-coin-form.tsx` fields, canonical vs. public vs. cloned sets, ownership/gap/completion — and a first-time or anonymous visitor has no in-app way to learn what any of it means. A static glossary page is low-cost (no schema, no API, no auth) and keeps a definition one click away instead of sending the user off-site.

## Decision

A single static `/glossary` route in `apps/web`, content as a plain TS data file (array of `{ termKey, definition }`, mirrors the shape i18n keys already take — no markdown/MDX dependency, since none exists in the repo today and one term list doesn't justify adding one). Two tiers of terms:

- **App-grounded terms** — vocabulary the app actually surfaces today: mint mark, variety, denomination, country, catalog, canonical set, user set, public set / cloning a set, ownership, gap view, completion percentage. These map directly to existing i18n label keys (`common.mintMark`, etc.) so the glossary's wording stays consistent with what the rest of the UI already calls things.
- **General numismatic terms** — vocabulary a coin collector encounters regardless of what this app currently models (grade, proof, mintage, obverse/reverse, patina, uncirculated, key date, etc.). Include a handful of the most common ones for completeness, but resist turning this into an exhaustive numismatics dictionary — see "Explicitly NOT this scope" below.

Route is public, unauthenticated, always-visible in nav (same tier as `/catalog`/`/sets/canonical`/`/sets/public`) — not gated behind login, since the point is helping a visitor who doesn't understand the terms yet, including anonymous ones.

**Current relevant state, so the tasks below don't re-derive it:** `apps/web/src/app/` is a flat route tree with no `(app)`/`(auth)` groups (`catalog/`, `sets/`, `dashboard/`, `collection/`, `login/`, `signup/`, each a top-level `page.tsx`) — `glossary/page.tsx` follows the same top-level pattern, no group needed. `apps/web/src/components/layout/site-nav.tsx` is a `'use client'` component; always-visible links (`/`, `/catalog`, `/sets/canonical`, `/sets/public`) live in lines 36–52, each `<Link href=... data-testid="site-nav-<name>-link" className={navLinkClassName}>{t('nav.<name>')}</Link>`, before the auth-conditional block starts — a `/glossary` link belongs in that same group. i18n is fully built and already wired (contradicting an earlier backlog's assumption it might not be yet): `apps/web/src/lib/i18n/` — hand-rolled, no library — `useTranslation()` from `i18n-context.tsx` returns `{ locale, t, setLocale }`, `I18nProvider` wraps the tree in `layout.tsx`, dictionaries are flat `Record<string,string>` in `locales/en.ts`/`locales/es.ts` keyed by dot-namespaced strings, `en.ts` is the source of truth for the `MessageKey` type. `apps/web/src/components/layout/site-footer.tsx` is the only existing static-content precedent — three i18n keys glued into JSX, not a useful template for a multi-term list. No markdown/MDX dependency exists in `apps/web/package.json` — don't add one for this. `docs/system-design_v2.md` §3.1 (lines 136–151) has the frontend routes table; `/glossary` needs a row there, `Auth: none`, and confirmation it's excluded from the auth-redirect middleware's route list (line 159).

---

## Term list (draft)

Starting point for 1.1/1.2 — write the actual `en.ts`/`es.ts` copy from this, but feel free to tighten wording at implementation time. Grouped by tier per the Decision section; alphabetical within each.

**App-grounded terms** (map to existing i18n label keys / app concepts):

- **Canonical set** — an admin-curated set of coins (e.g. "Lincoln Wheat Cents") that any user can clone as a starting point for their own collection.
- **Cloning a set** — copying another set's coin list into a new set of your own, either from a canonical set or from another user's public set. Ownership isn't copied — only the list of coins.
- **Completion percentage** — the share of a set's coins you currently own, shown as a rounded percentage on the set's gap view.
- **Country** — the issuing country of a coin (e.g. USA), one of the fields used to identify it in the catalog.
- **Denomination** — the face value of a coin (e.g. Cent, Nickel, Dollar).
- **Gap view** — the list, for one of your sets, of which coins you already own and which are still missing.
- **Mint mark** — a small letter on a coin showing which mint produced it (e.g. "S" for San Francisco, "D" for Denver). Coins with no mint mark were struck at the main Philadelphia mint.
- **Ownership** — marking a coin in the catalog as one you own. Ownership is global to your account — owning a coin once counts toward every set it appears in, not just one.
- **Public set** — any set built in this app is visible and cloneable by other users by default; there's no private-set option yet.
- **User set** — a set you've built yourself, whether from scratch, by filtering the catalog, or by cloning a canonical or public set.
- **Variety** — a distinguishing feature of a specific coin beyond year/mint mark (e.g. a design change or minting error), when the catalog records one.

**General numismatic terms** (common collecting vocabulary, not all currently modeled by the app):

- **Grade** — a standardized rating of a coin's physical condition, from heavily worn to pristine (e.g. Good, Fine, Uncirculated).
- **Key date** — a year (and sometimes mint mark) of a given coin type that was minted in unusually low numbers, making it harder to find and more valuable than others in the same series.
- **Mintage** — the total number of coins of a given type produced in a given year/mint.
- **Numismatics** — the study or collecting of coins, tokens, and paper currency.
- **Obverse** — the front (or "heads") side of a coin.
- **Patina** — the natural color or sheen a coin's surface develops over time from age and handling.
- **Proof** — a coin struck using a special high-precision process for collectors, with a mirror-like finish, rather than for general circulation.
- **Reverse** — the back (or "tails") side of a coin.
- **Uncirculated** — a coin that shows no wear from having been used in everyday transactions.

Not included, deliberately: highly specific variety/error terminology (doubled die, VDB, re-punched mint mark, and similar) — these are real numismatic terms but not currently modeled as distinct fields anywhere in the v2 catalog (they'd only ever show up as free text inside `variety`), so defining them here would set an expectation the app doesn't back up yet. Revisit if/when the catalog schema grows dedicated support for them.

---

## Frontend

- [ ] 1.1 New `apps/web/src/lib/glossary-terms.ts` — exported const array of `{ termKey: string; termLabel: string; definitionKey: string }` (or similar; final shape TBD at implementation), covering the app-grounded and general term tiers from the Decision section above. Keep it a plain data file, no fetching, no CMS.
- [ ] 1.2 Add the corresponding `glossary.term.*`/`glossary.definition.*` keys to **both** `apps/web/src/lib/i18n/locales/en.ts` and `es.ts` together, per the existing convention (a missing translation is a `tsc` error by design) — definitions written in plain, non-jargon language, one to three sentences each.
- [ ] 1.3 New `apps/web/src/app/glossary/page.tsx` — renders the term list via `useTranslation()`, alphabetically sorted, each entry as a term + definition pair; a short intro line distinguishing "terms this app uses" from "general collecting terms" if the two tiers end up visually separated (decide layout at implementation time — a single flat alphabetical list is also acceptable if simpler).
- [ ] 1.4 `apps/web/src/components/layout/site-nav.tsx` — add a `/glossary` link (`data-testid="site-nav-glossary-link"`, `t('nav.glossary')`) alongside the existing always-visible links (lines 36–52), before the auth-conditional block. Add the `nav.glossary` key to `en.ts`/`es.ts`.
- [ ] 1.5 `docs/system-design_v2.md` §3.1 — add a `/glossary` row to the frontend routes table (`Auth: none`), and confirm/note it's excluded from the auth-redirect middleware's route list.
- [ ] 1.6 Component test (`apps/web/src/app/glossary/page.test.tsx`) — renders the full term list, confirms both tiers (if visually separated) or the full flat list appear, confirms no missing-translation crash.
- [ ] 1.7 Manual browser pass: load `/glossary` anonymously (no console errors, no auth redirect), confirm the nav link works from every other page, switch locale via `LanguageSwitcher` and confirm definitions actually change language, not just labels.
- [ ] 1.8 `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint`.

## Wrap-up

- [ ] 2.1 Add a dated `CLAUDE.md` changelog entry once shipped.

---

**Checkpoint:** an anonymous or logged-in visitor can reach a `/glossary` page from the main nav, see a static list of coin-collecting terms (both app-specific and general numismatic vocabulary) with plain-language definitions in their chosen locale, with zero backend/DB/auth involvement.

## Explicitly NOT this scope (resist)

- **An exhaustive numismatics dictionary.** A handful of general terms for completeness, not a competitor to Wikipedia's coin-terminology coverage — if the list grows past roughly 20–30 terms, that's a sign to stop, not to keep adding.
- **Backend-driven or admin-editable content.** No `glossary_terms` table, no CMS, no submission/moderation flow — this is a static data file shipped with the frontend, edited via a normal code change like any other UI copy.
- **Auto-linking term mentions elsewhere in the app** (e.g. turning "mint mark" into a glossary link wherever it appears in the catalog or forms). A nice future enhancement, not part of this pass — keep this backlog to the standalone page and its nav entry only.
- **Search or filtering within the glossary.** A short static list doesn't need it; revisit only if the term count grows enough to matter.
- **Per-coin-type or per-country glossary variants.** One global list, not scoped to `denomination`/`country`.
