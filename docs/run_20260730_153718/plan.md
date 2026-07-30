# Technical Plan: Migrate language switcher from two buttons to a single dropdown

**Run:** run_20260730_153718
**Date:** 2026-07-30

## Summary

`LanguageSwitcher` (`apps/web/src/components/layout/language-switcher.tsx`) currently renders two separate `<button>` toggles (English/Spanish). This plan replaces that markup with a single native `<select>` dropdown, keeping the component's existing named export, props (none), and its `useTranslation()`/`setLocale` wiring unchanged. `SiteNav` already renders exactly one `<LanguageSwitcher />` and needs no changes.

## Approach

1. Rewrite the JSX inside `LanguageSwitcher` to render one controlled `<select>` element instead of two `<button>` elements:
   - `value={locale}`, `onChange={(e) => setLocale(e.target.value as Locale)}`.
   - Two `<option>` children, in fixed order: `value="en"` / text `t('languageSwitcher.english')`, then `value="es"` / text `t('languageSwitcher.spanish')`.
   - Root wrapper `<div data-testid="language-switcher">` is kept (unchanged testid) so no other file needs updating.
2. Drop the button-specific styling/`aria-pressed` logic entirely — a native `<select>` already conveys the current value and is natively keyboard-operable, satisfying PRD criterion 7 without any new ARIA wiring.
3. No change to `useTranslation`, `setLocale`, `I18nProvider`, `LOCALE_STORAGE_KEY`, or the locale dictionaries (`en.ts`/`es.ts`) — persistence (`setLocale` writes to `localStorage`) is unchanged, it's called from a new place (`onChange` instead of two `onClick`s).
4. `SiteNav` is not modified — it already imports and renders a single `<LanguageSwitcher />` (confirmed by reading `apps/web/src/components/layout/site-nav.tsx`), so PRD criterion 8 is already satisfied and needs no code change, only a test asserting it stays true.
5. Edge case: initial render must reflect `useTranslation()`'s current `locale` (default `'en'`, or a persisted value restored by `I18nProvider`'s effect) with no separate local state in `LanguageSwitcher` — the `<select>`'s `value` prop is driven directly from context, so there is nothing to desync.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/web/src/components/layout/language-switcher.tsx | MODIFY | Replace the two-button toggle with a single controlled `<select>` dropdown |
| apps/web/src/components/layout/language-switcher.test.tsx | MODIFY | Rewrite tests for dropdown/select behavior (replaces the old two-button assertions entirely) |
| apps/web/src/components/layout/site-nav.test.tsx | MODIFY | Existing "criterion 3: language switcher is mounted" block asserts `language-switcher-en`/`language-switcher-es` testids, which no longer exist once the buttons are removed — swap those two assertions for `language-switcher-select`. No other describe block in this file changes. |

## Interface Contract

### Component: LanguageSwitcher
- **File:** `apps/web/src/components/layout/language-switcher.tsx` (existing path, unchanged)
- **Export:** `export function LanguageSwitcher()` — named export, unchanged (do NOT switch to a default export; `site-nav.tsx` imports it as `{ LanguageSwitcher }`)
- **Props:** none (unchanged — component takes no props, reads everything from `useTranslation()`)
- **Test selectors** (every data-testid the tests will need):
  - `data-testid="language-switcher"` — root wrapper `<div>` (unchanged from the current implementation)
  - `data-testid="language-switcher-select"` — the `<select>` element itself (new; replaces the removed `language-switcher-en` / `language-switcher-es` button testids, which no longer exist)
- **Element/behavior contract** (for Tester/Coder alignment, since a native `<select>` needs no extra ARIA role — its implicit role is exposed to Testing Library as `combobox`):
  - `<select data-testid="language-switcher-select" value={locale} onChange={...}>` — controlled by `useTranslation().locale`
  - `onChange` calls `setLocale(event.target.value as Locale)`
  - Exactly two `<option>` children, in this order: `<option value="en">{t('languageSwitcher.english')}</option>`, `<option value="es">{t('languageSwitcher.spanish')}</option>`
  - No `aria-pressed` anywhere (button-only concept, removed with the buttons)
- **Dependencies:** `useTranslation` from `@/lib/i18n/i18n-context`; `Locale` type from `@/lib/i18n/types` (new type-only import needed for the `onChange` cast)

### Existing (unmodified) dependency: SiteNav
- **File:** `apps/web/src/components/layout/site-nav.tsx` — not modified. Already renders a single `<LanguageSwitcher />` with `data-testid="site-nav"` on its root `<nav>`. Listed here only so the Tester can write a regression assertion (criterion 8) without re-deriving these existing testids.
- **Test file requiring an update:** `apps/web/src/components/layout/site-nav.test.tsx` already has a `describe('criterion 3: language switcher is mounted in the site chrome')` block asserting `getByTestId('language-switcher-en')` and `getByTestId('language-switcher-es')` — both selectors are removed by this migration. Replace those two lines with a single `getByTestId('language-switcher-select')` assertion (keep the existing `getByTestId('language-switcher')` line as-is). This is the mechanism that satisfies criterion 8 (SiteNav still renders exactly one `LanguageSwitcher`) — no other part of `site-nav.test.tsx` changes.

### Pre-existing testids (declared for contract-check purposes only)

`site-nav.test.tsx` is preserved almost verbatim (only its language-switcher assertions change, per above) and references these existing, unmodified `SiteNav` testids — restated here so `check-contract.sh`'s test-vs-contract check doesn't flag them as invented by this run:
- `data-testid="site-nav"`
- `data-testid="site-nav-brand"`
- `data-testid="site-nav-catalog-link"`
- `data-testid="site-nav-canonical-link"`
- `data-testid="site-nav-public-link"`
- `data-testid="site-nav-dashboard-link"`
- `data-testid="site-nav-collection-link"`
- `data-testid="site-nav-logout"`
- `data-testid="site-nav-login-link"`
- `data-testid="site-nav-signup-link"`

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. Single dropdown, not two buttons, inside `data-testid="language-switcher"` | New `<select>` markup replacing the two `<button>`s, same root wrapper testid |
| 2. Trigger displays the active language's label | `<select value={locale}>` — the browser renders the `<option>` matching `value` as the shown/selected text |
| 3. Exactly the two existing locale options, no new locales | Two `<option>` elements only, `en`/`es`, sourced from the existing `languageSwitcher.english`/`languageSwitcher.spanish` keys |
| 4. Selecting an option calls `setLocale` and updates the displayed label | `onChange={(e) => setLocale(e.target.value as Locale)}`; label updates automatically since `value` is bound to context `locale` |
| 5. Selection persists to `localStorage` under `LOCALE_STORAGE_KEY` | Unchanged `setLocale` implementation in `i18n-context.tsx` (not touched) already does this — new call site (`onChange`) triggers the same code path |
| 6. Initial render reflects current context locale, no flash of wrong language | `<select>`'s `value` is derived directly from `useTranslation().locale` on every render, no intermediate local state |
| 7. Keyboard-operable, accessible roles/labels for listbox/combobox pattern | Native `<select>` semantics (implicit `combobox`/listbox behavior, full keyboard support) — no custom widget needed |
| 8. `SiteNav` renders exactly one `LanguageSwitcher` | Pre-existing, unmodified `site-nav.tsx` — verified by reading the file; Tester adds a regression assertion only |

## Risks and open questions

- **Native `<select>` vs. a custom-built dropdown widget:** chose native `<select>` because the repo has no headless-ui/Radix/similar dependency, and `package.json` has no reason for one to be introduced for this task (self-review checklist: no new dependency). Native semantics also satisfy PRD criterion 7 exactly as worded ("...or native `<select>` semantics"), with zero extra ARIA wiring.
- **No new `aria-label` translation key added:** a labelled control (e.g. a new `languageSwitcher.label` dictionary key for `aria-label`) would be a nice-to-have for the control's accessible name, but the PRD's Out-of-scope section explicitly limits translation-content changes to the two labels already present (`languageSwitcher.english`/`languageSwitcher.spanish`). Criterion 7 as written does not require it (native `<select>` semantics are called out as sufficient), so this plan does not touch `en.ts`/`es.ts`/`dictionaries.test.ts`. If a future task wants a labelled control, that's a follow-up, not part of this migration.
- **`site-nav.tsx` needs no code change**, only confirmed by reading it — the Tester should still assert criterion 8 against the real file to catch any future regression, not skip it because "nothing changed here."
