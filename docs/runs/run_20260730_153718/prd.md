# PRD: Migrate language switcher from two buttons to a single dropdown

**Run:** run_20260730_153718
**Date:** 2026-07-30

## Goal

The site navigation currently renders language selection as two separate, always-visible toggle buttons ("English" / "Spanish") inside `LanguageSwitcher` (`apps/web/src/components/layout/language-switcher.tsx`), used by `SiteNav`. As more locales are added this will not scale and clutters the nav bar. This task consolidates the two buttons into a single dropdown control that shows the active language and lets the user pick a different one, for any visitor of the web app who wants to change the site's display language.

## User stories

- As a site visitor, I want to see one compact language control in the nav so the header stays uncluttered.
- As a site visitor, I want to open a dropdown and see the current language clearly marked so I know what's active.
- As a site visitor, I want to pick a different language from the dropdown so the UI immediately switches to it.
- As a site visitor, I want my language choice to be remembered on my next visit, same as today.
- As a keyboard/screen-reader user, I want the dropdown to be operable and announced correctly so I'm not blocked from switching languages.

## Acceptance criteria

1. `LanguageSwitcher` renders a single dropdown control (not two separate buttons) inside a root element with `data-testid="language-switcher"`.
2. The dropdown trigger displays the currently active language's label (e.g. "English" when `locale === 'en'`).
3. The dropdown exposes exactly the two existing locale options ("English" / `languageSwitcher.english`, "Spanish" / `languageSwitcher.spanish`) — no new locales are added.
4. Selecting a different language option from the dropdown calls `setLocale` with that locale's code, and the trigger's displayed label updates to reflect the new active locale.
5. Selecting a language persists it: after selection, `localStorage` under `LOCALE_STORAGE_KEY` (from `@/lib/i18n/types`) is set to the chosen locale code, matching current persistence behavior.
6. On initial render, the dropdown reflects whatever locale `useTranslation()` currently reports as active (default or previously persisted), with no flash of the wrong language.
7. The dropdown is operable via keyboard (focusable trigger, selectable options) and exposes accessible roles/labels appropriate for a listbox/combobox pattern (e.g. `aria-haspopup`/`role="listbox"` or native `<select>` semantics) so screen readers can announce it correctly.
8. `SiteNav` continues to render exactly one `LanguageSwitcher` instance in the nav bar (no other nav location changes).

## Out of scope

- Adding new languages/locales beyond English and Spanish.
- Any change to translation content/strings in `en.ts` / `es.ts` beyond what's needed for the dropdown labels already present (`languageSwitcher.english`, `languageSwitcher.spanish`).
- Redesigning other parts of `SiteNav` (auth links, brand, nav links) or moving the switcher to a different location in the layout.
- Changing how `useTranslation` / `setLocale` / `I18nProvider` work internally — this is a presentation-only migration of `LanguageSwitcher`.
- Mobile-specific nav/hamburger-menu behavior (no separate mobile nav currently exists in `SiteNav`).

## Open questions

None.
