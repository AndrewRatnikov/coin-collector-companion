# Technical Plan: Implement the "Coin Collector Companion" Classical design

**Run:** run_20260728_071525
**Date:** 2026-07-28

**Required reading before implementing:** `runs/run_20260728_071525/design-spec.md` (exact copy/tokens/behavior per view) and `runs/run_20260728_071525/codebase-survey.md` (exact current state of every file below, including every existing `data-testid` and test assertion). This plan is the single source of truth for **names** (files, exports, props, new testids); the two files above are the single source of truth for **exact copy strings and current behavior**. Do not re-derive either — read them.

## Summary

This is a full visual restyle of 13 existing, working Next.js pages (apps/web) from generic Tailwind styling to the "Classical" design system (Cormorant Garamond / IBM Plex Sans / IBM Plex Mono, warm-neutral hairline-rule aesthetic, exact tokens in design-spec.md), plus the shared nav/i18n/global-styles infrastructure they depend on. All real data fetching, mutations, and auth stay wired to the existing `apps/api` backend via the existing hooks in `apps/web/src/lib/hooks/*.ts` — nothing here is a mock. Three pages (Home, New Set, Set Editor) need genuinely new client-side logic beyond pure restyle, because the design specifies interaction patterns (live counts, a coin-by-coin set builder, decade-grouped accordions) that don't exist in the current implementation; every other page is markup/token/copy changes only.

## Approach

1. **Foundation first** (tokens, fonts, nav, i18n) — these affect every page, so they're built and their own tests pass before touching individual pages.
2. **Simple restyle pages next** (Home, Catalog, Coin Detail, Canonical Sets ×2, Public Sets ×2, Login, Signup, Collection, Dashboard) — markup/class/copy changes to match design-spec.md's per-view breakdown, preserving all existing `data-testid`s and hook usage exactly as documented in codebase-survey.md §10, except where a testid is explicitly listed as ADD/REMOVE below.
3. **Structural rework pages last** (New Set, Set Editor) — these need new local state and, for New Set, a second mutation call, on top of the restyle.
4. Known spec-vs-real-data gaps (codebase-survey.md §9) are resolved as follows, uniformly:
   - Key-date stars: **omitted everywhere** (no `isKeyDate` field exists on `CatalogCoin`).
   - Public set "Kept by {author}" byline and set descriptions: **omitted** for public/user sets (no author/description field exists); canonical sets keep their real `description` field per spec.
   - Catalog/Collection/New-Set/Set-Editor filter inputs: **stay free-text `<input>`s** (no distinct-value endpoint exists), restyled to visually match the design's select/input chrome. A "Clear" link-button is added to every filter form that doesn't already have one (Catalog, Collection, and the New-Set/Set-Editor catalogue pickers), since that's pure front-end state and explicitly in the design.
   - Collection's year filter: **stays exact-match against the real API** (changing to prefix-match would require fetching unfiltered data client-side or a backend change, both out of scope); only the visual treatment changes, not filter semantics.
   - Pagination (Catalog, Public Sets): **changes from Prev/Next to numbered page links**, per spec — this is a pure front-end change since `page`/`limit`/`total` are already returned.
   - Canonical/Public Set Detail "Clone this set": **stays the existing `<Link>` to a pre-filled New Set form** (not an instant clone) — restyle the link as the spec's solid-accent CTA, do not change the navigation behavior.
   - `nav.canonicalSets` / `nav.publicSets` copy: **changed to Title Case** ("Canonical Sets", "Public Sets") to match design-spec.md, and the locked assertions in `dictionaries.test.ts` are updated accordingly (permitted by PRD acceptance criterion 14).
   - Signup's confirm-password field and Set Editor's delete button + rename mechanism: **real features with no spec equivalent** — kept, restyled, not removed. Set Editor's separate rename form is replaced by a single inline-editable heading input (see its Interface Contract block) since that's what the design specifies and it's a strict behavioral superset (same mutation, one less click).
   - Coin-submission feature (`SubmitCoinForm`/`SubmissionConfirmation`) on the Catalog page: **out of the design spec entirely** — keep it fully functional, give it only a token/color/font pass so it doesn't look visually foreign, do not invent new "Classical" structure for it.
5. Global CSS custom properties for every token in design-spec.md's "Design tokens" section are added to `apps/web/src/app/globals.css`'s `:root`, replacing the legacy Next.js starter tokens there now (`--background`, `--foreground`, the `prefers-color-scheme: dark` block, and the Arial `body` rule are all removed — this app ships one fixed light theme, no dark mode).
6. Three Google Fonts (Cormorant Garamond, IBM Plex Sans, IBM Plex Mono) are loaded via `next/font/google` in `apps/web/src/app/layout.tsx`, replacing the current Geist/Geist Mono loaders, following the exact same `variable`-className pattern already used there.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/web/src/app/globals.css | MODIFY | Replace legacy tokens with Classical design tokens (colors, fonts, spacing, radius, shadow); drop dark-mode block |
| apps/web/src/app/layout.tsx | MODIFY | Swap Geist/Geist Mono for Cormorant Garamond / IBM Plex Sans / IBM Plex Mono via next/font/google |
| apps/web/src/app/design-tokens.test.ts | CREATE | Added after test-reviewer flagged criterion 1 (design tokens) as untested — reads globals.css/layout.tsx source text and asserts the Classical tokens/fonts are present, since these two files have no exports/testids to render/mount against |
| apps/web/src/components/layout/site-nav.tsx | MODIFY | Add brand link + Sign up link, restyle to Classical tokens |
| apps/web/src/components/layout/site-nav.test.tsx | MODIFY | Add assertions for new brand/signup elements |
| apps/web/src/components/layout/site-footer.tsx | MODIFY | Token/color pass only, no structural change |
| apps/web/src/components/layout/language-switcher.tsx | MODIFY | Token/color pass only |
| apps/web/src/lib/i18n/locales/en.ts | MODIFY | Add new copy keys (home.*, plus per-page additions listed below); update nav.canonicalSets/nav.publicSets to Title Case; add nav.brand, nav.signUp |
| apps/web/src/lib/i18n/locales/es.ts | MODIFY | Mirror every new/changed key from en.ts (key parity is a compile-time requirement) |
| apps/web/src/lib/i18n/locales/dictionaries.test.ts | MODIFY | Update the two locked nav.canonicalSets/nav.publicSets assertions to Title Case |
| apps/web/src/components/ui/skeleton.tsx | MODIFY | Token/color pass only |
| apps/web/src/components/ui/list-skeleton.tsx | MODIFY | Token/color pass only |
| apps/web/src/components/auth/form-field.tsx | MODIFY | Token/color pass only, keep id/aria wiring intact |
| apps/web/src/components/catalog/catalog-filter-form.tsx | MODIFY | Restyle to Classical input chrome; add a Clear button (new `${testIdPrefix}-filter-clear` testid) |
| apps/web/src/components/catalog/submit-coin-form.tsx | MODIFY | Token/color pass only |
| apps/web/src/components/catalog/submission-confirmation.tsx | MODIFY | Token/color pass only |
| apps/web/src/app/page.tsx | MODIFY | Full rewrite: Home per design-spec.md, add live counts |
| apps/web/src/app/page.test.tsx | CREATE | New test file (none exists today) |
| apps/web/src/app/catalog/page.tsx | MODIFY | Restyle; numbered pagination; Clear filters |
| apps/web/src/app/catalog/page.test.tsx | MODIFY | Update pagination assertions for numbered-page style |
| apps/web/src/app/catalog/[coinId]/page.tsx | MODIFY | Restyle; add owned/missing toggle + "Appears in your sets" |
| apps/web/src/app/catalog/[coinId]/page.test.tsx | MODIFY | Add assertions for new toggle + appears-in-sets behavior |
| apps/web/src/app/sets/canonical/page.tsx | MODIFY | Restyle only |
| apps/web/src/app/sets/canonical/page.test.tsx | MODIFY | Update only if copy assertions change |
| apps/web/src/app/sets/canonical/[id]/page.tsx | MODIFY | Restyle; clone CTA becomes solid-accent button styling |
| apps/web/src/app/sets/canonical/[id]/page.test.tsx | MODIFY | Update only if copy assertions change |
| apps/web/src/app/sets/public/page.tsx | MODIFY | Restyle; numbered pagination |
| apps/web/src/app/sets/public/page.test.tsx | MODIFY | Update pagination assertions for numbered-page style |
| apps/web/src/app/sets/public/[id]/page.tsx | MODIFY | Restyle; add "you already own N of M" summary line |
| apps/web/src/app/sets/public/[id]/page.test.tsx | MODIFY | Add assertion for overlap summary |
| apps/web/src/app/login/page.tsx | MODIFY | Restyle only, preserve real auth/error handling |
| apps/web/src/app/login/page.test.tsx | MODIFY | Update only if copy assertions change |
| apps/web/src/app/signup/page.tsx | MODIFY | Restyle only, preserve confirm-password + real auth/error handling |
| apps/web/src/app/signup/page.test.tsx | MODIFY | Update only if copy assertions change |
| apps/web/src/app/dashboard/page.tsx | MODIFY | Restyle; add 3 stat tiles (Sets/Coins owned/Average completion) |
| apps/web/src/app/dashboard/page.test.tsx | MODIFY | Add assertions for new stat tiles |
| apps/web/src/app/collection/page.tsx | MODIFY | Restyle; show year+mint per row; add Clear filters |
| apps/web/src/app/collection/page.test.tsx | MODIFY | Update only if copy/markup assertions change |
| apps/web/src/app/sets/new/page.tsx | MODIFY | Replace native selects with source-picker list; add coin-by-coin catalogue picker before creation |
| apps/web/src/app/sets/new/page.test.tsx | MODIFY | Replace select-based assertions with source-list assertions; add picker/add/remove assertions |
| apps/web/src/app/sets/[id]/page.tsx | MODIFY | Inline-editable name; decade-grouped accordions; all/missing toggle; collapsible add-coins picker |
| apps/web/src/app/sets/[id]/page.test.tsx | MODIFY | Update name-heading, ordering, and add-coins-panel-visibility assertions for the new structure |

## Interface Contract

All existing `data-testid` values not explicitly listed as REMOVE below are **preserved exactly as documented in codebase-survey.md §2–§10** — the Tester and Coder must not rename or drop them. Only additions/removals are enumerated per file.

### `apps/web/src/app/globals.css` + `apps/web/src/app/layout.tsx`
- No exports/props/testids (infra only). `layout.tsx` keeps its current default export and JSX tree (`I18nProvider > QueryProvider > SiteNav + {children} + SiteFooter`) unchanged; only the font loader calls and the `<html>` `className` change.
- `globals.css` `:root` must define every custom property listed in design-spec.md's "Design tokens" section verbatim (values, not renamed), plus `--font-heading`, `--font-body`, `--font-mono` each composed from the corresponding `next/font/google` `variable` CSS var with a system-font fallback (e.g. `--font-heading: var(--font-heading-family), 'Cormorant Garamond', serif;`).
- Remove: `--background`, `--foreground`, the `@media (prefers-color-scheme: dark)` block, the plain `body { font-family: Arial }` rule.

### `apps/web/src/components/layout/site-nav.tsx`
- Default export unchanged (`SiteNav`).
- **ADD** `data-testid="site-nav-brand"` — the brand element (button or link), text = new i18n key `nav.brand` = `"Coin Collector Companion"`, `onClick`/`href` → `/`.
- **ADD** `data-testid="site-nav-signup-link"` — shown only when signed out, alongside the existing `site-nav-login-link`, text = new i18n key `nav.signUp` = `"Sign up"`, links to `/signup`.
- Preserve exactly: `site-nav`, `site-nav-catalog-link`, `site-nav-canonical-link`, `site-nav-public-link`, `site-nav-dashboard-link`, `site-nav-collection-link`, `site-nav-logout`, `site-nav-login-link`.
- Copy changes (in `en.ts`): `nav.canonicalSets` → `"Canonical Sets"`, `nav.publicSets` → `"Public Sets"` (Title Case). `nav.catalog`, `nav.dashboard`, `nav.collection`, `nav.logOut`, `nav.logIn` are unchanged.

### `apps/web/src/lib/i18n/locales/en.ts` / `es.ts`
New keys required (exact English values below; Spanish values just need to exist with matching keys — translation quality is not evaluated):
- `nav.brand` = `"Coin Collector Companion"`
- `nav.signUp` = `"Sign up"`
- `home.eyebrow` = `"Est. catalogue & personal ledger"`
- `home.headline` = `"A quiet place to record what you have — and what you are still looking for."`
- `home.paragraph` = `"Define a set on your own terms, mark the coins you own, and see the gaps that remain. Browsing needs no account."`
- `home.browseCatalogue` = `"Browse the catalogue"`
- `home.browseCanonical` = `"Browse canonical sets"`
- `home.browsePublic` = `"Browse collectors' sets"`
- `home.coinsUnit` = `"coins"`, `home.setsUnit` = `"sets"` (component composes `"{count} {unit}"`, matching the design's monospace count column — no template-string i18n key needed)
- `dashboard.statSets` = `"Sets"`, `dashboard.statCoinsOwned` = `"Coins owned"`, `dashboard.statAverageCompletion` = `"Average completion"`
- `coinDetail.markOwned` = `"Mark as owned"`, `coinDetail.removeOwned` = `"Remove from collection"`, `coinDetail.inCollection` = `"In your collection"`, `coinDetail.loginPrompt` = `"Log in to record this coin in your collection."`, `coinDetail.appearsInSets` = `"Appears in your sets"`
- `publicSetDetail.overlap` = `"You already own"` (component appends `"{n} of {total}"` after it, tabular-nums, matching spec's `"You already own {{ detailOverlap }}"` pattern)
- `setNew.chooseCanonical` = `"Choose a canonical set"`, `setNew.choosePublic` = `"Choose a collector's set"`, `setNew.inThisSet` = `"In this set"`, `setNew.nothingAdded` = `"Nothing added yet."`, `setNew.add` = `"Add"`, `setNew.remove` = `"Remove"`, `setNew.createSet` = `"Create Set"`, `setNew.addFromCatalogue` = `"Add from the catalogue"`
- `setEditor.allCoins` = `"All coins"`, `setEditor.missing` = `"missing"`, `setEditor.addCoins` = `"Add coins"`, `setEditor.closePicker` = `"Close picker"`, `setEditor.markOwned` = `"Mark owned"`, `setEditor.undo` = `"Undo"`, `setEditor.noCoinsYet` = `"No coins yet — add some below."`
- `common.clear` = `"Clear"` (reused by every filter form's new Clear button)
Every other page's existing copy stays on its current i18n keys, restyled in place — do not invent new keys where an existing one already renders the right text per design-spec.md's per-view copy.

### `apps/web/src/lib/i18n/locales/dictionaries.test.ts`
Update the two locked assertions:
```
en['nav.canonicalSets'] === 'Canonical Sets'   // was 'Canonical sets'
en['nav.publicSets']    === 'Public Sets'      // was 'Public sets'
```
All other locked assertions (`nav.catalog`, `nav.dashboard`, `nav.collection`, `nav.logOut`, `nav.logIn`, `common.somethingWentWrong`, `languageSwitcher.english`, `languageSwitcher.spanish`) stay byte-identical — do not touch them.

### `apps/web/src/app/page.tsx` — Home
- Default export `Home` unchanged. Becomes a full rewrite per design-spec.md's "isHome" section.
- **ADD** hooks: `useCatalog({ page: 1, limit: 1 })` (for `.data.total`), `useCanonicalSets()` (for `.data.length`), `usePublicSets({ page: 1, limit: 1 })` (for `.data.total`). While any is loading, render the link row without a count (no loading testid needed — this is a non-blocking enhancement, not a gate).
- **ADD** testids: `home-page` (root `<main>`), `home-eyebrow`, `home-headline`, `home-paragraph`, `home-catalog-link`, `home-canonical-link`, `home-public-link` (each of the three is the whole row, a `<Link>`).
- No auth gating.

### `apps/web/src/app/catalog/page.tsx`
- No export/prop changes. Preserve all existing testids.
- **ADD** a Clear button inside `CatalogFilterForm` (see its own contract block below), testid pattern `${testIdPrefix}-filter-clear` → renders as `catalog-filter-clear` on this page — resets all filter fields to empty and re-submits with page 1.
- **CHANGE** pagination: replace the Prev/indicator/Next block with numbered page links. **REMOVE** `catalog-page-prev`, `catalog-page-indicator`, `catalog-page-next`. **ADD** `data-testid="catalog-pagination-page"` repeated once per page number (same testid on every instance, exactly like the existing `catalog-item` per-row pattern), each rendering the page number as text, with `aria-current="page"` on the active one and no `href`/`onClick` on the active one (matches design-spec.md's "active is non-clickable text, others are links").
- Test file must be updated: replace prev/next-disabled-state assertions with numbered-page assertions (assert the correct count of `catalog-pagination-page` elements, the active one via `aria-current`, and clicking an inactive one calls `useCatalog` with that page).

### `apps/web/src/components/catalog/catalog-filter-form.tsx`
- Default export `CatalogFilterForm` unchanged. Props unchanged (`testIdPrefix` plus existing filter/callback props per codebase-survey.md §6).
- **ADD** a Clear button: `data-testid="${testIdPrefix}-filter-clear"`, text from `common.clear`, resets the form's local field state to empty and calls the same submit callback the form's Submit button uses (so parent pages re-fetch with cleared filters, matching Catalog's existing "resets to page 1 on filter submit" test pattern).
- Preserve exactly: `${testIdPrefix}-filter-form`, `-filter-country`, `-filter-denomination`, `-filter-name`, `-filter-year-min`, `-filter-year-max`, `-filter-submit`.

### `apps/web/src/app/catalog/[coinId]/page.tsx`
- No export/prop changes. Preserve all 12 existing testids listed in codebase-survey.md §10.3.
- **ADD** hooks: `getStoredToken()` (already imported pattern elsewhere) for signed-in check; `useCollection()` (flat, unpaginated — already used by the Collection page) to determine `coinIsOwned = data?.some(item => item.coinId === coinId)`; `useSetOwnership()` mutation for the toggle; `useUserSets()` plus a `useQueries` fan-out calling `getSetGaps(set.id)` for each of the user's own sets (same pattern as Dashboard) to compute `coinAppearsIn = sets.filter(s => gapsById[s.id]?.slots.some(slot => slot.coin.id === coinId))`.
- **ADD** testids: `coin-detail-owned-toggle` (single button; text is `coinDetail.markOwned` or `coinDetail.removeOwned` depending on `coinIsOwned`, calls `useSetOwnership().mutate({coinId, owned: !coinIsOwned})`), `coin-detail-login-prompt` (shown instead of the toggle when signed out), `coin-detail-sets-list` (ul, only rendered if `coinAppearsIn.length > 0` and signed in), `coin-detail-set-item` (li per set, repeated testid, a `<Link href="/sets/{id}">` showing the set's name).

### `apps/web/src/app/sets/canonical/page.tsx` and `apps/web/src/app/sets/canonical/[id]/page.tsx`
- No export/prop/testid/hook changes at all — pure token/copy/layout restyle. The clone CTA on the detail page keeps testid `canonical-set-clone-cta` and its existing `<Link href="/sets/new?cloneFrom=canonical&cloneFromId={id}">` behavior, restyled as the design's solid-accent button.

### `apps/web/src/app/sets/public/page.tsx`
- Same numbered-pagination change as Catalog: **REMOVE** `public-sets-page-prev`, `public-sets-page-indicator`, `public-sets-page-next`; **ADD** `data-testid="public-sets-pagination-page"` (repeated, same pattern as `catalog-pagination-page`). No other changes.

### `apps/web/src/app/sets/public/[id]/page.tsx`
- No export/prop/hook changes — `usePublicSet`, `useSetGaps`, `getStoredToken()` stay exactly as today. Preserve all existing testids.
- **ADD** `data-testid="public-set-detail-overlap"` — a line rendered only when signed in and gaps loaded successfully, text composed from `publicSetDetail.overlap` + `"{gaps.ownedCount} of {gaps.slots.length}"` (both fields already present on the already-fetched `GapViewResponse`, no new fetch).

### `apps/web/src/app/login/page.tsx` and `apps/web/src/app/signup/page.tsx`
- No export/prop/hook/testid changes — pure layout/token restyle of the existing form, fields, and error handling exactly as documented in codebase-survey.md §10.8–10.9. Signup keeps its confirm-password field and both keep their real `login()`/`register()` calls and error taxonomy unchanged.

### `apps/web/src/app/dashboard/page.tsx`
- No export/hook removal — keep `useUserSets()` + the existing `useQueries` fan-out over `getSetGaps(set.id)`. Preserve all existing testids.
- **ADD** testids: `dashboard-stat-sets` (text = `sets.length`), `dashboard-stat-coins-owned` (text = sum of `ownedCount` across all resolved gap query results — a coin owned in two sets counts twice; this is a known, accepted simplification, not a bug), `dashboard-stat-average-completion` (text = mean of `completionPercent` across all resolved gap query results, rounded). All three render `—` (or are simply omitted) while their underlying `useQueries` results are still loading, consistent with the existing per-row `dashboard-set-completion` loading behavior.

### `apps/web/src/app/collection/page.tsx`
- No export/hook changes (`useCollection(filters)` stays exact-match on `year`, per plan §4). Preserve all existing testids.
- **ADD** `data-testid="collection-filter-clear"` (same Clear pattern as Catalog, local to this page's own inline filter form — not the shared `CatalogFilterForm`).
- `collection-item` rows now also render `{{ coin.year }} {{ coin.mintMark }}` (data already present on `OwnershipItem.coin`, no new fetch) — no new testid needed, it's additional content inside the existing `collection-item` element.

### `apps/web/src/app/sets/new/page.tsx`
- Default exports `NewSetForm`/`NewSetPage` unchanged. Keep `useCanonicalSets()`, `usePublicSets({page:1,limit:50})`, `useCreateSet()`, and the existing `useSearchParams()` read of `cloneFrom`/`cloneFromId` for pre-selection.
- **ADD** hooks: `useCanonicalSet(selectedCanonicalId)` / `usePublicSet(selectedPublicId)` (conditionally enabled, only fires once a source is picked) to fetch that source's full coin-id list; `usePatchSetCoins(newSetId)` (called only after `useCreateSet()` succeeds, as a second step, only if the final picked-coin list differs from an empty/cloned-source baseline).
- **REMOVE** `set-new-canonical-select`, `set-new-public-select` (native `<select>`s).
- **ADD**:
  - `data-testid="set-new-source-list"` (ul, shown when mode ≠ blank) and `data-testid="set-new-source-item"` (li per canonical/public set, repeated testid; clicking selects it as `src`, sets `aria-pressed="true"`/a "Selected" text on the chosen one, and pre-fills the coin picker's baseline from that source's coin ids once its detail hook resolves).
  - `data-testid="set-new-picker-panel"` wrapping a `<CatalogFilterForm testIdPrefix="set-new-picker">` and `data-testid="set-new-picker-results"` (ul) / `data-testid="set-new-picker-item"` (li, repeated, each with `data-testid="set-new-picker-add-button"` — adds that coin's id to local `pickedCoinIds` if not already present, and excludes coins already in `pickedCoinIds` from this results list, same as design-spec.md's picker).
  - `data-testid="set-new-in-set-list"` (ul of `pickedCoinIds`) / `data-testid="set-new-in-set-item"` (li, repeated, each with `data-testid="set-new-in-set-remove-button"` removing that id from `pickedCoinIds`) / `data-testid="set-new-in-set-empty"` (shown when `pickedCoinIds.length === 0`).
- **Behavior**: on submit, call `useCreateSet().mutate({ name, cloneFrom: mode !== 'blank' ? { type: mode === 'canonical' ? 'canonical' : 'user', id: selectedSourceId } : undefined })`; on success, if `pickedCoinIds` differs from the source's original id list (mode ≠ blank) or is non-empty (mode = blank), immediately call `usePatchSetCoins(result.id).mutate({ add: idsToAdd, remove: idsToRemove })` before navigating to `/sets/{result.id}`. Preserve existing testids `set-new-page`, `set-new-name-input`, `set-new-mode-blank`, `set-new-mode-canonical`, `set-new-mode-public`, `set-new-error`, `set-new-submit`.
- Test file must be updated: remove all `set-new-canonical-select`/`set-new-public-select` assertions, replace with `set-new-source-list`/`set-new-source-item` assertions (including the `cloneFrom` query-param pre-selection test); add new assertions for the picker Add/Remove flow and the two-step create-then-patch submit behavior.

### `apps/web/src/app/sets/[id]/page.tsx` — Set Editor
- Default exports `SetEditor`/`SetEditorPage` unchanged. Keep every existing hook: `usePublicSet(id)`, `useSetGaps(id)`, `useUserSets()` (for `isOwner`), `usePatchSetCoins(id)`, `useSetOwnership()`, `useRenameSet()`, `useDeleteSet()`, `useCatalog(addCoinsFilters)`.
- **REMOVE** `set-editor-rename-form`, `set-editor-rename-input`, `set-editor-rename-submit` (owner-only rename UI).
- **ADD** `data-testid="set-editor-name-input"` — replaces the rename form: an `<input>` styled as the heading, `value` = set name (local state seeded from the fetched set, only editable when `isOwner`), calls `useRenameSet().mutate({id, name})` on blur (or debounced change) when the value differs from the last-saved name. **Non-owners** still see a plain heading with `data-testid="set-editor-name"` (unchanged, read-only) — `set-editor-name-input` only exists in the owner branch.
- Preserve `set-editor-delete-button` exactly (place it near the top-right, alongside where the design reserves its "origin" label area — there is no origin/provenance field in the real data model, so this area is just the delete button, restyled).
- **ADD** `data-testid="set-editor-show-all-toggle"` and `data-testid="set-editor-show-missing-toggle"` — two buttons (local state `gapOnly: boolean`, default `false`), `aria-pressed` reflects which is active; copy from `setEditor.allCoins` / `{{missing}} {{setEditor.missing}}`.
- **CHANGE** the flat `set-editor-gap-grid` into decade-grouped accordions, computed client-side from `gaps.slots` (already includes `coin.year`): group by `Math.floor(coin.year / 10) * 10`, sort groups ascending, default **all groups open** (`collapsed` state starts empty so every existing item-level test assertion that expects all items visible without extra interaction still holds). **ADD** `data-testid="set-editor-decade-group"` (repeated, one per decade, wrapping its items), `data-testid="set-editor-decade-toggle"` (repeated, the header button — text = decade label e.g. "1910s" + owned/total summary — toggles that decade's collapsed state, keyed by `` `${id}-${decadeLabel}` `` local state map). When `gapOnly` is true, only render slots where `owned === false`, and hide any decade group left with zero slots. Preserve `set-editor-gap-grid` as the still-present outer wrapper testid (now containing decade groups instead of items directly), and preserve `set-editor-gap-item`, `set-editor-gap-status`, `set-editor-toggle-owned-button`, `set-editor-remove-button` exactly as-is on each leaf row inside its decade group.
- **ADD** `data-testid="set-editor-toggle-add-coins"` — button that shows/hides the existing add-coins panel (`set-editor-add-coins-panel`), local state `pickerOpen: boolean`, default `false`; text from `setEditor.addCoins` / `setEditor.closePicker`. The panel and its contents (`set-editor-add-coins-panel`, `set-editor-add-coins-results`, `set-editor-add-coins-item`, `set-editor-add-coins-add-button`, inherited `CatalogFilterForm` testids) are unchanged structurally, just now conditionally rendered on `pickerOpen`.
- Test file must be updated: (a) the owner-branch heading assertion moves from `set-editor-name` text content to `set-editor-name-input` value; (b) item ordering assertions change from `position`-order to decade-then-`position`-order; (c) add-coins-panel assertions must first click `set-editor-toggle-add-coins` before asserting panel contents are present; (d) rename-form assertions become "type into `set-editor-name-input` and blur" instead of "fill `set-editor-rename-input` and click `set-editor-rename-submit`".

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. Global design tokens applied app-wide | globals.css + layout.tsx font loaders |
| 2. Sticky header matches spec | site-nav.tsx (brand + signup additions, Title Case copy, restyle) |
| 3. Home page matches spec with real live counts | page.tsx rewrite + useCatalog/useCanonicalSets/usePublicSets |
| 4. Catalog page matches spec | catalog/page.tsx restyle + catalog-filter-form.tsx Clear button + numbered pagination |
| 5. Coin Detail matches spec | catalog/[coinId]/page.tsx owned-toggle + appears-in-sets additions |
| 6. Canonical Sets list/detail match spec incl. Clone CTA | sets/canonical/page.tsx + sets/canonical/[id]/page.tsx restyle |
| 7. Public Sets list/detail match spec incl. badges + overlap | sets/public/page.tsx + sets/public/[id]/page.tsx restyle + overlap addition |
| 8. Login/Signup match spec, real auth preserved | login/page.tsx + signup/page.tsx restyle only |
| 9. Dashboard matches spec with stat tiles | dashboard/page.tsx stat tile additions |
| 10. Collection matches spec | collection/page.tsx restyle + Clear button + year/mint column |
| 11. New Set matches spec | sets/new/page.tsx source-list + picker rework |
| 12. Set Editor matches spec | sets/[id]/page.tsx inline rename + decade accordions + toggles |
| 13. All pages keep using real data/hooks | Explicitly preserved hook usage in every per-file contract block above; no page is rewired to the design mock's in-memory data |
| 14. Existing tests updated, no regressions | Per-file "test file must be updated" notes above; every other existing test is explicitly preserved unchanged |

## Risks and open questions

- **Set Editor and New Set are the highest-risk files** — they require genuinely new client logic (decade grouping/collapse state, two-step create-then-patch mutation flow), not just restyle, and Set Editor's test file is already the largest (413 lines) with the most structural assertions to update. If the Coder's first attempt fails the test sandbox, expect the failure to be concentrated here.
- **Dashboard's "coins owned" stat double-counts** a coin present in more than one of the user's sets (summed across per-set `ownedCount`, not deduplicated against `useCollection()`'s true unique count). This is a deliberate simplification (avoids an extra fetch) rather than a bug; flagging so the Coder doesn't "fix" it into a mismatch with the design's single clean number, and so review doesn't flag it as an unexplained defect.
- **Primary-button fill vs. outline** and **inline SVG vs. Lucide icons**: per design-spec.md's open questions, this plan directs solid-fill accent buttons (matching the mock exactly) and inline SVG (zero new dependency, matches codebase-survey.md §1's confirmation that no icon library is installed). The Coder should not add `lucide-react` as a new dependency.
- **`home.title` i18n key becomes unused** once Home is rewritten with the new `home.*` keys — leaving it in `en.ts`/`es.ts` is harmless (key-parity check doesn't require every key be referenced) but the Coder may remove it from both files if confirmed unused elsewhere, to avoid dead entries.
- The Tester should write tests file-by-file following this contract exactly; where a test file is marked MODIFY, the existing assertions not called out above as changed should be left alone — this is an additive/targeted update to each test file, not a rewrite from scratch.

## Testid contract appendix (literal declarations)

The prose contract above describes new/changed/removed testids per file and says every other existing testid from codebase-survey.md is preserved unchanged. This appendix restates **every** testid literally, in `data-testid="value"` form, so the mechanical contract gate (which only pattern-matches this exact string form, not prose) can verify it — this section adds no new information, it is a literal-format restatement of what's already specified above and in codebase-survey.md.

```
data-testid="site-nav" data-testid="site-nav-catalog-link" data-testid="site-nav-canonical-link" data-testid="site-nav-public-link" data-testid="site-nav-dashboard-link" data-testid="site-nav-collection-link" data-testid="site-nav-logout" data-testid="site-nav-login-link" data-testid="site-nav-brand" data-testid="site-nav-signup-link"
data-testid="language-switcher" data-testid="language-switcher-en" data-testid="language-switcher-es"
data-testid="home-page" data-testid="home-eyebrow" data-testid="home-headline" data-testid="home-paragraph" data-testid="home-catalog-link" data-testid="home-canonical-link" data-testid="home-public-link"
data-testid="catalog-page" data-testid="catalog-submit-coin-entry" data-testid="catalog-submit-coin-toggle" data-testid="catalog-loading" data-testid="catalog-error" data-testid="catalog-empty" data-testid="catalog-results" data-testid="catalog-item" data-testid="catalog-pagination" data-testid="catalog-pagination-page"
data-testid="catalog-filter-form" (DYNAMIC via CatalogFilterForm's testIdPrefix prop, literal string only exists at render time — not grep-detectable in source): data-testid=catalog-filter-country data-testid=catalog-filter-denomination data-testid=catalog-filter-name data-testid=catalog-filter-year-min data-testid=catalog-filter-year-max data-testid=catalog-filter-submit data-testid=catalog-filter-clear
data-testid="submit-coin-form" data-testid="submit-coin-form-error" data-testid="submit-coin-submit" data-testid="submission-confirmation"
TEST-FILE-ONLY (vi.mock() stub testids rendered inside catalog/page.test.tsx's own mock factories — never part of the production implementation, must NOT appear in code/): data-testid=mock-submit-coin-form data-testid=mock-submit-coin-form-succeed data-testid=mock-submission-confirmation
data-testid="coin-detail-page" data-testid="coin-detail-loading" data-testid="coin-detail-error" data-testid="coin-detail-label" data-testid="coin-detail-pending-badge" data-testid="coin-detail-country" data-testid="coin-detail-denomination" data-testid="coin-detail-year" data-testid="coin-detail-mint-mark" data-testid="coin-detail-variety" data-testid="coin-detail-image" data-testid="coin-detail-attribution" data-testid="coin-detail-owned-toggle" data-testid="coin-detail-login-prompt" data-testid="coin-detail-sets-list" data-testid="coin-detail-set-item"
data-testid="canonical-sets-page" data-testid="canonical-sets-loading" data-testid="canonical-sets-error" data-testid="canonical-sets-empty" data-testid="canonical-sets-list" data-testid="canonical-set-item"
data-testid="canonical-set-detail-page" data-testid="canonical-set-detail-loading" data-testid="canonical-set-detail-error" data-testid="canonical-set-detail-name" data-testid="canonical-set-detail-description" data-testid="canonical-set-clone-cta" data-testid="canonical-set-coin-list" data-testid="canonical-set-coin-item"
data-testid="public-sets-page" data-testid="public-sets-loading" data-testid="public-sets-error" data-testid="public-sets-empty" data-testid="public-sets-list" data-testid="public-set-item" data-testid="public-sets-pagination" data-testid="public-sets-pagination-page"
data-testid="public-set-detail-page" data-testid="public-set-detail-loading" data-testid="public-set-detail-error" data-testid="public-set-detail-name" data-testid="public-set-clone-cta" data-testid="public-set-detail-coin-list" data-testid="public-set-detail-coin-item" data-testid="public-set-detail-coin-status" data-testid="public-set-detail-overlap"
data-testid="login-page" data-testid="login-form" data-testid="login-form-error" data-testid="login-submit"
data-testid="signup-page" data-testid="signup-form" data-testid="signup-form-error" data-testid="signup-submit"
data-testid="dashboard-page" data-testid="dashboard-loading" data-testid="dashboard-error" data-testid="dashboard-empty" data-testid="dashboard-new-set-cta" data-testid="dashboard-set-list" data-testid="dashboard-set-item" data-testid="dashboard-set-completion" data-testid="dashboard-stat-sets" data-testid="dashboard-stat-coins-owned" data-testid="dashboard-stat-average-completion"
data-testid="collection-page" data-testid="collection-filter-form" data-testid="collection-filter-country" data-testid="collection-filter-year" data-testid="collection-filter-submit" data-testid="collection-filter-clear" data-testid="collection-loading" data-testid="collection-error" data-testid="collection-empty" data-testid="collection-list" data-testid="collection-item"
data-testid="set-new-page" data-testid="set-new-name-input" data-testid="set-new-mode-blank" data-testid="set-new-mode-canonical" data-testid="set-new-mode-public" data-testid="set-new-error" data-testid="set-new-submit" data-testid="set-new-source-list" data-testid="set-new-source-item" data-testid="set-new-picker-panel" data-testid="set-new-picker-results" data-testid="set-new-picker-item" data-testid="set-new-picker-add-button" data-testid="set-new-in-set-list" data-testid="set-new-in-set-item" data-testid="set-new-in-set-remove-button" data-testid="set-new-in-set-empty"
REMOVED (referenced only in negative queryByTestId(...).not.toBeInTheDocument() assertions confirming they no longer render): data-testid=set-new-canonical-select data-testid=set-new-public-select
data-testid="set-editor-page" data-testid="set-editor-loading" data-testid="set-editor-error" data-testid="set-editor-name" data-testid="set-editor-name-input" data-testid="set-editor-completion" data-testid="set-editor-delete-button" data-testid="set-editor-show-all-toggle" data-testid="set-editor-show-missing-toggle" data-testid="set-editor-gap-grid" data-testid="set-editor-decade-group" data-testid="set-editor-decade-toggle" data-testid="set-editor-gap-item" data-testid="set-editor-gap-status" data-testid="set-editor-toggle-owned-button" data-testid="set-editor-remove-button" data-testid="set-editor-toggle-add-coins" data-testid="set-editor-add-coins-panel" data-testid="set-editor-add-coins-results" data-testid="set-editor-add-coins-item" data-testid="set-editor-add-coins-add-button"
REMOVED (referenced only in negative queryByTestId(...).not.toBeInTheDocument() assertions confirming they no longer render, for the owner branch — set-editor-name stays valid for the non-owner read-only branch): data-testid=set-editor-rename-form data-testid=set-editor-rename-input data-testid=set-editor-rename-submit
```

Also covers, via the shared `CatalogFilterForm` component's `testIdPrefix` prop, the inherited pattern `data-testid="${testIdPrefix}-filter-form"` etc. for prefixes `catalog`, `set-editor-add-coins` (DYNAMIC, literal string only exists at render time — not grep-detectable in source): data-testid=set-editor-add-coins-filter-form data-testid=set-editor-add-coins-filter-country data-testid=set-editor-add-coins-filter-denomination data-testid=set-editor-add-coins-filter-name data-testid=set-editor-add-coins-filter-year-min data-testid=set-editor-add-coins-filter-year-max data-testid=set-editor-add-coins-filter-submit data-testid=set-editor-add-coins-filter-clear.
