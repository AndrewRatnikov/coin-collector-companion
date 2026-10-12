# The web app uses a dependency-free i18n layer with compile-time key parity

- **Status:** Accepted
- **Date:** 2026-07-26
- **Source:** orchestrator run `run_20260726_221855` (i18n infrastructure for `apps/web`)
- **Code:** `apps/web/src/lib/i18n/locales/en.ts`, `apps/web/src/lib/i18n/locales/es.ts`, `apps/web/src/lib/i18n/locales/dictionaries.test.ts`, `apps/web/src/lib/i18n/i18n-context.tsx`, `apps/web/src/lib/i18n/translate-field.ts`, `apps/web/src/components/layout/language-switcher.tsx`

## Context

Every user-visible phrase was hard-coded English in `.tsx` files and in `lib/*-api.ts` error strings. The task was infrastructure: route every phrase through an i18n system and prove it end to end with a second locale (an `es` stub), without adding a dependency and without touching about 40 existing test files.

## Decision

- **No i18n library.** Messages are a flat dictionary with dot-namespaced keys (`'nav.catalog'`). `locales/en.ts` is the source (`satisfies Record<string, string>`, so `MessageKey = keyof typeof en`). `locales/es.ts` is typed `Record<MessageKey, string>`, so a missing or extra key fails `tsc --noEmit`, and `dictionaries.test.ts` checks parity at test time too.
- **Context with a working English default.** `createContext` gets a real English implementation, not `undefined`. Any component calling `useTranslation()` renders English without an `<I18nProvider>`, so existing tests needed no wrapper.
- **Locale choice:** an explicit switcher (no `Accept-Language` detection), persisted in `localStorage`. The first render is always `en` on both server and client. A stored preference is applied in a `useEffect` after mount, which avoids hydration mismatches.
- **Data is translation-ready but not translated.** Coin and set names go through `resolveLocalizedText(value, locale, overrides?)`, which today always returns the value. No API, schema or seed change.

## Alternatives considered

- **next-intl, i18next or similar.** Rejected: a new dependency for two locales and flat strings. `t()` has no interpolation, so composite strings are built in JSX from keys plus values.
- **Cookie-based locale with server rendering.** Not done. See Consequences.

## Consequences

- Adding UI text always means adding the key to both `en.ts` and `es.ts` (`CLAUDE.md` repeats this rule).
- `<html lang>` stays `en` even when Spanish is selected, and a stored Spanish preference flashes English on first paint. Fixing either needs cookie-based locale selection.
- Translating catalog content later only needs `overrides` passed at the existing `resolveLocalizedText` call sites.
