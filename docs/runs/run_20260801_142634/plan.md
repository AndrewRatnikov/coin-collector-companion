# Technical Plan: Static Glossary Page

**Run:** run_20260801_142634
**Date:** 2026-08-01

## Summary

Adds a static, unauthenticated `/glossary` route to `apps/web` that lists coin-collecting terms (app-grounded + general numismatic) with plain-language definitions, sourced entirely from the existing i18n dictionaries. No backend, no DB, no new dependency — a plain TS data file (`glossary-terms.ts`) plus a page component that renders it via `useTranslation()`, following the same structural pattern as the existing no-fetch static pages (`app/page.tsx`) and the existing list-page pattern (`sets/public/page.tsx`).

## Approach

- `apps/web/src/lib/glossary-terms.ts` is a plain array of `{ id, tier, termKey, definitionKey }` objects — no fetching, no computed/derived testids (avoids the known `check-contract.sh` parameterized-selector false-positive class documented in `memory.md`: template-interpolated `data-testid` values aren't grep-visible as literal strings). Each entry's `termKey`/`definitionKey` are literal `MessageKey` values pointing at `en.ts`/`es.ts`.
- `apps/web/src/app/glossary/page.tsx` renders two `<section>`s (app-grounded tier, then general tier), each an alphabetically-pre-sorted (source-array-order, no runtime sort needed) `<ul>` of `<li>` rows. Every row uses the **same shared, repeated `data-testid`** across all rows in both lists — mirrors `sets/public/page.tsx`'s `public-set-item` convention exactly, tests use `getAllByTestId` + content assertions rather than one unique testid per term. This sidesteps the interpolated-selector contract-check gotcha entirely rather than working around it after the fact.
- `en.ts`/`es.ts` get 4 new structural keys (`nav.glossary`, `glossary.pageTitle`, `glossary.intro`, `glossary.appTermsHeading`, `glossary.generalTermsHeading` — 5, corrected below) plus 2 keys per term (`glossary.term.<id>`, `glossary.definition.<id>`) × 20 terms = 40 keys. Added together in both files per the existing convention (missing translation is a `tsc` error by design via `es.ts`'s `Record<MessageKey, string>` annotation).
- `site-nav.tsx` gets one new `<Link>` in the always-visible group (same tier as Catalog/Canonical Sets/Public Sets), before the auth-conditional block — matches the existing `nav.mySubmissions` precedent from `run_20260731_132040` exactly.
- `docs/system-design_v2.md` §3.1 gets a `/glossary` row (`Auth: none`). No middleware file exists in this repo (route protection is actually done per-page via the `RequireAuth` client component, confirmed by reading `require-auth.tsx` and `dashboard/page.tsx` directly — the doc's "Next.js middleware" prose describes intent, not the real mechanism). `/glossary` needs no `RequireAuth` wrapper (same as `catalog/page.tsx`, `sets/public/page.tsx`), which is what satisfies "excluded from auth-redirect" — no code change needed beyond simply not wrapping the page.
- No new dependency. No markdown/MDX. No API calls, no React Query.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/glossary-terms.ts` | CREATE | Static term data: id/tier/termKey/definitionKey array |
| `apps/web/src/app/glossary/page.tsx` | CREATE | Glossary page — renders the term list via `useTranslation()` |
| `apps/web/src/lib/i18n/locales/en.ts` | MODIFY | Add `nav.glossary`, `glossary.*` structural + term/definition keys |
| `apps/web/src/lib/i18n/locales/es.ts` | MODIFY | Add the same keys, Spanish values |
| `apps/web/src/components/layout/site-nav.tsx` | MODIFY | Add `/glossary` link to the always-visible group |
| `docs/system-design_v2.md` | MODIFY | Add `/glossary` row to §3.1 frontend routes table, `Auth: none` |

## Interface Contract

### Module: glossary-terms.ts

- **File:** `apps/web/src/lib/glossary-terms.ts`
- **Export:**
  ```typescript
  import type { MessageKey } from '@/lib/i18n/locales/en';

  export type GlossaryTier = 'app' | 'general';

  export interface GlossaryTermEntry {
    id: string;
    tier: GlossaryTier;
    termKey: MessageKey;
    definitionKey: MessageKey;
  }

  export const GLOSSARY_TERMS: GlossaryTermEntry[];
  ```
- **Contents:** exactly 20 entries, in this literal order (alphabetical within tier — no runtime sort in the page component):

  App tier (`tier: 'app'`), 11 entries, `id` / `termKey` / `definitionKey`:
  1. `canonical-set` / `glossary.term.canonicalSet` / `glossary.definition.canonicalSet`
  2. `cloning-a-set` / `glossary.term.cloningASet` / `glossary.definition.cloningASet`
  3. `completion-percentage` / `glossary.term.completionPercentage` / `glossary.definition.completionPercentage`
  4. `country` / `glossary.term.country` / `glossary.definition.country`
  5. `denomination` / `glossary.term.denomination` / `glossary.definition.denomination`
  6. `gap-view` / `glossary.term.gapView` / `glossary.definition.gapView`
  7. `mint-mark` / `glossary.term.mintMark` / `glossary.definition.mintMark`
  8. `ownership` / `glossary.term.ownership` / `glossary.definition.ownership`
  9. `public-set` / `glossary.term.publicSet` / `glossary.definition.publicSet`
  10. `user-set` / `glossary.term.userSet` / `glossary.definition.userSet`
  11. `variety` / `glossary.term.variety` / `glossary.definition.variety`

  General tier (`tier: 'general'`), 9 entries, `id` / `termKey` / `definitionKey`:
  12. `grade` / `glossary.term.grade` / `glossary.definition.grade`
  13. `key-date` / `glossary.term.keyDate` / `glossary.definition.keyDate`
  14. `mintage` / `glossary.term.mintage` / `glossary.definition.mintage`
  15. `numismatics` / `glossary.term.numismatics` / `glossary.definition.numismatics`
  16. `obverse` / `glossary.term.obverse` / `glossary.definition.obverse`
  17. `patina` / `glossary.term.patina` / `glossary.definition.patina`
  18. `proof` / `glossary.term.proof` / `glossary.definition.proof`
  19. `reverse` / `glossary.term.reverse` / `glossary.definition.reverse`
  20. `uncirculated` / `glossary.term.uncirculated` / `glossary.definition.uncirculated`

- **Dependencies:** `MessageKey` type only (type-only import, no runtime dependency on the dictionaries themselves)

### Component: GlossaryPage

- **File:** `apps/web/src/app/glossary/page.tsx`
- **Export:** `export default function GlossaryPage()`
- **Props:** none (route page component)
- **Behavior:** `'use client'`. Calls `useTranslation()` for `t`. Imports `GLOSSARY_TERMS` from `@/lib/glossary-terms`. Renders:
  - root `<main data-testid="glossary-page">`
  - `<h1>` with `t('glossary.pageTitle')` (no testid required — not asserted directly, `glossary-page` root covers presence)
  - `<p data-testid="glossary-intro">{t('glossary.intro')}</p>`
  - App tier section: `<h2 data-testid="glossary-app-terms-heading">{t('glossary.appTermsHeading')}</h2>` followed by `<ul data-testid="glossary-app-terms-list">`, one `<li data-testid="glossary-term">` per entry where `tier === 'app'`, in `GLOSSARY_TERMS` array order
  - General tier section: `<h2 data-testid="glossary-general-terms-heading">{t('glossary.generalTermsHeading')}</h2>` followed by `<ul data-testid="glossary-general-terms-list">`, one `<li data-testid="glossary-term">` per entry where `tier === 'general'`, in array order
  - Each `<li data-testid="glossary-term">` contains a term label element `<span data-testid="glossary-term-label">{t(entry.termKey)}</span>` and a definition element `<p data-testid="glossary-term-definition">{t(entry.definitionKey)}</p>`
  - **`glossary-term`/`glossary-term-label`/`glossary-term-definition` are the SAME literal testid repeated on every row in both lists** — deliberate, matches `sets/public/page.tsx`'s `public-set-item` convention. Tests identify specific terms via text-content assertions (`getAllByTestId('glossary-term')`, then check `.textContent` / use `within()` + `getByText`), not via unique per-term testids.
- **Test selectors** (every literal `data-testid` a test may reference):
  - `data-testid="glossary-page"` — root `<main>`
  - `data-testid="glossary-intro"` — intro paragraph
  - `data-testid="glossary-app-terms-heading"` — app-tier section heading
  - `data-testid="glossary-app-terms-list"` — app-tier `<ul>`
  - `data-testid="glossary-general-terms-heading"` — general-tier section heading
  - `data-testid="glossary-general-terms-list"` — general-tier `<ul>`
  - `data-testid="glossary-term"` — repeated on every `<li>` in both lists (11 in app list + 9 in general list = 20 total matches for `getAllByTestId('glossary-term')`)
  - `data-testid="glossary-term-label"` — repeated on every term's label span (20 matches)
  - `data-testid="glossary-term-definition"` — repeated on every term's definition paragraph (20 matches)
- **Dependencies:** `@/lib/i18n/i18n-context` (`useTranslation`), `@/lib/glossary-terms` (`GLOSSARY_TERMS`)
- **Test file:** `apps/web/src/app/glossary/page.test.tsx` (CREATE, Tester writes this)

### Existing (MODIFIED) component: SiteNav

- **File:** `apps/web/src/components/layout/site-nav.tsx`
- **Change:** add one `<Link>` to the always-visible group (lines 36–52 in current file, alongside `site-nav-catalog-link`/`site-nav-canonical-link`/`site-nav-public-link`, before the `border-l` auth-conditional `<div>`):
  ```tsx
  <Link href="/glossary" data-testid="site-nav-glossary-link" className={navLinkClassName}>
    {t('nav.glossary')}
  </Link>
  ```
- **New test selector:** `data-testid="site-nav-glossary-link"`
- **Test file:** `apps/web/src/components/layout/site-nav.test.tsx` (MODIFY, Tester adds one new describe block for this link, alongside the existing `criterion 2: always-visible links` block — same pattern as `run_20260731_132040`'s `site-nav-my-submissions-link` addition)

### Module: locale dictionaries (en.ts / es.ts)

- **Files:** `apps/web/src/lib/i18n/locales/en.ts`, `apps/web/src/lib/i18n/locales/es.ts`
- **New keys, exact values** (add as a new `// glossary` block; also add `nav.glossary` to the existing `// nav` block):

  | Key | en | es |
  |---|---|---|
  | `nav.glossary` | `Glossary` | `Glosario` |
  | `glossary.pageTitle` | `Glossary` | `Glosario` |
  | `glossary.intro` | `A quick reference for coin-collecting vocabulary — starting with terms this app uses directly, followed by general numismatic terms you may encounter elsewhere.` | `Una referencia rápida al vocabulario del coleccionismo de monedas: primero los términos que usa esta app directamente, luego términos numismáticos generales que puedes encontrar en otros lugares.` |
  | `glossary.appTermsHeading` | `Terms this app uses` | `Términos que usa esta app` |
  | `glossary.generalTermsHeading` | `General collecting terms` | `Términos generales de numismática` |
  | `glossary.term.canonicalSet` | `Canonical set` | `Colección canónica` |
  | `glossary.definition.canonicalSet` | `An admin-curated set of coins (e.g. "Lincoln Wheat Cents") that any user can clone as a starting point for their own collection.` | `Una colección de monedas curada por un administrador (p. ej., "Lincoln Wheat Cents") que cualquier usuario puede clonar como punto de partida para su propia colección.` |
  | `glossary.term.cloningASet` | `Cloning a set` | `Clonar una colección` |
  | `glossary.definition.cloningASet` | `Copying another set's coin list into a new set of your own, either from a canonical set or from another user's public set. Ownership isn't copied — only the list of coins.` | `Copiar la lista de monedas de otra colección a una nueva colección propia, ya sea desde una colección canónica o desde la colección pública de otro usuario. La propiedad no se copia, solo la lista de monedas.` |
  | `glossary.term.completionPercentage` | `Completion percentage` | `Porcentaje de finalización` |
  | `glossary.definition.completionPercentage` | `The share of a set's coins you currently own, shown as a rounded percentage on the set's gap view.` | `La proporción de monedas de una colección que actualmente posees, mostrada como un porcentaje redondeado en la vista de vacíos de la colección.` |
  | `glossary.term.country` | `Country` | `País` |
  | `glossary.definition.country` | `The issuing country of a coin (e.g. USA), one of the fields used to identify it in the catalog.` | `El país emisor de una moneda (p. ej., EE. UU.), uno de los campos usados para identificarla en el catálogo.` |
  | `glossary.term.denomination` | `Denomination` | `Denominación` |
  | `glossary.definition.denomination` | `The face value of a coin (e.g. Cent, Nickel, Dollar).` | `El valor nominal de una moneda (p. ej., centavo, níquel, dólar).` |
  | `glossary.term.gapView` | `Gap view` | `Vista de vacíos` |
  | `glossary.definition.gapView` | `The list, for one of your sets, of which coins you already own and which are still missing.` | `La lista, para una de tus colecciones, de qué monedas ya posees y cuáles aún faltan.` |
  | `glossary.term.mintMark` | `Mint mark` | `Marca de ceca` |
  | `glossary.definition.mintMark` | `A small letter on a coin showing which mint produced it (e.g. "S" for San Francisco, "D" for Denver). Coins with no mint mark were struck at the main Philadelphia mint.` | `Una pequeña letra en una moneda que indica qué ceca la produjo (p. ej., "S" para San Francisco, "D" para Denver). Las monedas sin marca de ceca se acuñaron en la ceca principal de Filadelfia.` |
  | `glossary.term.ownership` | `Ownership` | `Propiedad` |
  | `glossary.definition.ownership` | `Marking a coin in the catalog as one you own. Ownership is global to your account — owning a coin once counts toward every set it appears in, not just one.` | `Marcar una moneda del catálogo como una que posees. La propiedad es global a tu cuenta: poseer una moneda una vez cuenta para todas las colecciones en las que aparece, no solo una.` |
  | `glossary.term.publicSet` | `Public set` | `Colección pública` |
  | `glossary.definition.publicSet` | `Any set built in this app is visible and cloneable by other users by default; there's no private-set option yet.` | `Toda colección creada en esta app es visible y clonable por otros usuarios de forma predeterminada; todavía no existe la opción de colección privada.` |
  | `glossary.term.userSet` | `User set` | `Colección de usuario` |
  | `glossary.definition.userSet` | `A set you've built yourself, whether from scratch, by filtering the catalog, or by cloning a canonical or public set.` | `Una colección que has creado tú mismo, ya sea desde cero, filtrando el catálogo o clonando una colección canónica o pública.` |
  | `glossary.term.variety` | `Variety` | `Variedad` |
  | `glossary.definition.variety` | `A distinguishing feature of a specific coin beyond year/mint mark (e.g. a design change or minting error), when the catalog records one.` | `Una característica distintiva de una moneda específica más allá del año o la marca de ceca (p. ej., un cambio de diseño o un error de acuñación), cuando el catálogo la registra.` |
  | `glossary.term.grade` | `Grade` | `Grado` |
  | `glossary.definition.grade` | `A standardized rating of a coin's physical condition, from heavily worn to pristine (e.g. Good, Fine, Uncirculated).` | `Una calificación estandarizada del estado físico de una moneda, desde muy desgastada hasta impecable (p. ej., Bueno, Fino, Sin circular).` |
  | `glossary.term.keyDate` | `Key date` | `Fecha clave` |
  | `glossary.definition.keyDate` | `A year (and sometimes mint mark) of a given coin type that was minted in unusually low numbers, making it harder to find and more valuable than others in the same series.` | `Un año (y a veces marca de ceca) de un tipo de moneda que se acuñó en cantidades inusualmente bajas, lo que la hace más difícil de encontrar y más valiosa que otras de la misma serie.` |
  | `glossary.term.mintage` | `Mintage` | `Acuñación` |
  | `glossary.definition.mintage` | `The total number of coins of a given type produced in a given year/mint.` | `La cantidad total de monedas de un tipo determinado producidas en un año y ceca dados.` |
  | `glossary.term.numismatics` | `Numismatics` | `Numismática` |
  | `glossary.definition.numismatics` | `The study or collecting of coins, tokens, and paper currency.` | `El estudio o coleccionismo de monedas, fichas y papel moneda.` |
  | `glossary.term.obverse` | `Obverse` | `Anverso` |
  | `glossary.definition.obverse` | `The front (or "heads") side of a coin.` | `El lado frontal (o "cara") de una moneda.` |
  | `glossary.term.patina` | `Patina` | `Pátina` |
  | `glossary.definition.patina` | `The natural color or sheen a coin's surface develops over time from age and handling.` | `El color o brillo natural que la superficie de una moneda desarrolla con el tiempo por el uso y la edad.` |
  | `glossary.term.proof` | `Proof` | `Prueba` |
  | `glossary.definition.proof` | `A coin struck using a special high-precision process for collectors, with a mirror-like finish, rather than for general circulation.` | `Una moneda acuñada mediante un proceso especial de alta precisión para coleccionistas, con un acabado espejado, en lugar de para circulación general.` |
  | `glossary.term.reverse` | `Reverse` | `Reverso` |
  | `glossary.definition.reverse` | `The back (or "tails") side of a coin.` | `El lado posterior (o "cruz") de una moneda.` |
  | `glossary.term.uncirculated` | `Uncirculated` | `Sin circular` |
  | `glossary.definition.uncirculated` | `A coin that shows no wear from having been used in everyday transactions.` | `Una moneda que no muestra desgaste por haber sido usada en transacciones cotidianas.` |

  (44 new keys total per file: 5 structural + 2×20 term/definition — 9 tier/heading/intro keys listed as 5 rows above is correct: `nav.glossary`, `glossary.pageTitle`, `glossary.intro`, `glossary.appTermsHeading`, `glossary.generalTermsHeading`.)

### Existing (MODIFIED) doc: system-design_v2.md

- **File:** `docs/system-design_v2.md`
- **Change:** in §3.1's frontend routes table, add a row `| \`/glossary\` | none | Static coin-collecting term glossary — app-specific and general numismatic vocabulary |` (place after the `/sets/public/[id]` row, before `/login`, `/signup`, matching the existing none-auth grouping). No middleware code exists to modify — see Approach section.

### Pre-existing testids (declared for contract-check purposes only)

`apps/web/src/components/layout/site-nav.test.tsx` is preserved verbatim except for one new describe block (see Existing (MODIFIED) component: SiteNav above). `check-contract.sh`'s `TESTID_NOT_IN_CONTRACT` check has no memory of prior runs' Interface Contracts (documented in `memory.md`'s Known gotchas), so every pre-existing testid the preserved test content references must be restated here even though none of them are new/modified in this run:

- `data-testid="language-switcher"`
- `data-testid="language-switcher-select"`
- `data-testid="require-auth-pending"`
- `data-testid="site-nav"`
- `data-testid="site-nav-brand"`
- `data-testid="site-nav-canonical-link"`
- `data-testid="site-nav-catalog-link"`
- `data-testid="site-nav-collection-link"`
- `data-testid="site-nav-dashboard-link"`
- `data-testid="site-nav-login-link"`
- `data-testid="site-nav-logout"`
- `data-testid="site-nav-my-submissions-link"`
- `data-testid="site-nav-public-link"`
- `data-testid="site-nav-signup-link"`

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `/glossary` renders anonymously, no redirect, no console errors | `GlossaryPage` has no `RequireAuth` wrapper, no auth checks — same shape as `catalog/page.tsx`/`sets/public/page.tsx` |
| 2. App-grounded terms present (11 named terms) | `GLOSSARY_TERMS` app-tier entries 1–11 in Interface Contract |
| 3. General numismatic terms present (9 named terms) | `GLOSSARY_TERMS` general-tier entries 12–20 |
| 4. All labels/definitions from i18n dictionaries, no hardcoded strings | `GlossaryPage` renders only `t(entry.termKey)`/`t(entry.definitionKey)`/`t('glossary.*')`; data file holds only `MessageKey` references |
| 5. `/glossary` nav link, `data-testid="site-nav-glossary-link"`, always-visible group | SiteNav MODIFY block |
| 6. Locale switch re-renders term labels/definitions | `t()` is locale-reactive via `useTranslation()`'s context (existing mechanism, no new logic needed — confirmed same pattern already covered by `i18n-context.test.tsx`) |
| 7. Component test renders full term list, no missing-translation fallback | `glossary/page.test.tsx` (Tester writes; asserts `getAllByTestId('glossary-term')` length 20, spot-checks label/definition text for a sample from each tier, asserts no raw `glossary.` key-shaped text is ever rendered) |
| 8. typecheck/build/test/lint all pass | Standard sandbox run (Stage 6) |
| 9. `system-design_v2.md` updated, route confirmed excluded from auth-redirect | Docs MODIFY block; confirmed no middleware file exists, so "exclusion" is structural (page isn't wrapped in `RequireAuth`), documented in Approach |

## Risks and open questions

- The backlog's task 1.7 ("manual browser pass") is explicitly a human/manual step, not automatable by this pipeline — left undone here, consistent with the established convention (see `memory.md` gotcha on live-DB/manual steps) of deferring manual-only checklist items rather than marking them done on the strength of automated tests alone.
- Spanish translations above are original (not pulled from an existing glossary/reference) — a native-speaker proofread pass is reasonable follow-up but not required for the acceptance criteria (criterion 6 only requires text to actually change per-locale, not translation quality review).
- `docs/backlog_glossary.md`'s own checkbox list (1.1–1.8, 2.1) is a planning artifact from before this run; this plan supersedes it as the source of truth for what actually gets built. Not marking backlog checkboxes as part of this run — out of scope for the Architect/Coder stages.
