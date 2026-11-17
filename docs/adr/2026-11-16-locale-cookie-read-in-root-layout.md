# The root layout reads the visitor's locale from a `ccc-locale` cookie, so `<html lang>` and the first render match it

- **Status:** Accepted
- **Date:** 2026-11-16
- **Source:** orchestrator run `run_20261117_063301` (signed-out landing page and growth backlog Step 1, item 1.4; brief `docs/design/2026-11-16_landing.md`, "Locale on first paint")
- **Code:** `apps/web/src/app/layout.tsx`, `apps/web/src/lib/i18n/locale-cookie.ts`, `apps/web/src/lib/i18n/types.ts`, `apps/web/src/lib/i18n/i18n-context.tsx`

## Context

The locale choice lived only in `localStorage` ([2026-07-26-dependency-free-i18n](2026-07-26-dependency-free-i18n.md)). The server can't read `localStorage`, so the first render was always English on both server and client, and a stored Spanish preference was applied in an effect after mount. A Spanish visitor saw an English flash on every page load, and the server-rendered `<html lang>` was always `en`, which is wrong for screen readers and search engines until hydration patched it. Growth backlog 1.4 asks for the right `lang` on first paint, and the new signed-out landing page is the first page where that first impression matters.

## Decision

- **Cookie.** The locale is stored in a cookie named `ccc-locale` (`LOCALE_COOKIE_NAME`, the same string as `LOCALE_STORAGE_KEY`) as well as in `localStorage`. `writeLocaleCookie` assigns exactly `ccc-locale=<locale>; path=/; max-age=31536000; SameSite=Lax`: one year, sent on top-level navigation, readable by the client (not `HttpOnly`, because the provider writes it from the browser; no `Secure`, so it also works on `http://localhost`). It holds only `en` or `es`, nothing personal.
- **Supported locales in one list.** `types.ts` exports `LOCALES = ['en', 'es'] as const` and derives `Locale` from it. `isLocale` checks membership; `parseLocale(value)` returns the locale or `'en'` for a missing or unknown value; `readLocaleCookie(cookieString = document.cookie)` returns the locale or `null`. `locale-cookie.ts` has no `'use client'` and no module-level `window`/`document` access, so the server layout can import it.
- **Root layout.** `RootLayout` is `async`, reads `(await cookies()).get(LOCALE_COOKIE_NAME)?.value` through `parseLocale`, renders `<html lang={locale}>` and passes `initialLocale={locale}` to `I18nProvider`.
- **Provider.** `I18nProvider` takes `initialLocale` (default `'en'`) and starts its state from it, so the server render and the first client render agree and hydration doesn't mismatch. `setLocale` writes both `localStorage` and the cookie.
- **Migration.** On mount, a valid `localStorage` locale is applied (if it differs) and copied into the cookie when the cookie is missing or different, so visitors who chose Spanish before the cookie existed get it from their next page load on. A cookie with no `localStorage` value changes nothing. `localStorage` stays the source of the choice; the cookie is the server's copy of it.

## Alternatives considered

- **An inline script that sets `document.documentElement.lang` before paint.** Rejected: the page text would still render in English until hydration, so `lang` and the content would disagree, and the English flash would remain.
- **Keep `localStorage` only.** Rejected: the English flash and the wrong server-rendered `lang` stay, which is what 1.4 is about.
- **`Accept-Language` detection.** Not done. The language stays an explicit choice made with the switcher, as in the 2026-07-26 ADR; a visitor without the cookie gets English.

## Consequences

- Reading cookies in the root layout makes **every route dynamically rendered** (`ƒ` instead of `○` in the `next build` route table). That is acceptable today: every page fetches its data in the browser anyway, so static prerendering only saved the empty shell. Step 3 of `docs/backlog_growth.md` (server rendering for search) revisits rendering per route and may need to move the cookie read or accept the cost per page.
- This supersedes two parts of [2026-07-26-dependency-free-i18n](2026-07-26-dependency-free-i18n.md): the locale-choice clause "the first render is always `en` on both server and client", and the alternative "Cookie-based locale with server rendering: Not done". The rest of that ADR (no library, flat typed dictionaries, English default context) still holds.
- A new locale is one entry in `LOCALES` plus its dictionaries; `parseLocale` and `isLocale` pick it up.
- Tests: `locale-cookie.test.ts` (parse, read, exact cookie string), `i18n-context.test.tsx` (`initialLocale`, cookie writes, migration), and `layout-locale.test.ts` (source checks on `layout.tsx`, since nothing renders the async layout in vitest).
