# The en and es dictionaries are split into ten per-area files per locale, with each es area typed against its en area

- **Status:** Accepted
- **Date:** 2026-11-10
- **Source:** orchestrator run `run_20261110_062926` (refactor phase 1 of 4: split the i18n dictionaries by area)
- **Code:** `apps/web/src/lib/i18n/locales/en/index.ts`, `apps/web/src/lib/i18n/locales/es/index.ts`, `apps/web/src/lib/i18n/locales/en/common.ts`, `apps/web/src/lib/i18n/locales/es/common.ts`, `apps/web/src/lib/i18n/locales/dictionaries.test.ts`

## Context

`locales/en.ts` (753 lines) and `locales/es.ts` (748 lines) each held 650 flat dot keys under 33 prefixes. They were too large to read or edit in one piece. The task was a pure refactor: no key, value or call site may change. Imports (`@/lib/i18n/locales/en`, `./locales/es`) and the precise `MessageKey` union had to keep working.

## Decision

Each locale becomes a folder, `locales/en/` and `locales/es/`, with ten area files (`common`, `account`, `browse-sets`, `collection`, `catalog`, `grades`, `sets`, `set-new`, `glossary`, `add-coins`) and an `index.ts`. Key blocks were moved verbatim. Every import path resolves to the folder's `index.ts` under `moduleResolution: "bundler"`, so no other source file changed. `en.ts` and `es.ts` are deleted.

- `en/index.ts` spreads the areas into `enShape` (`satisfies Record<string, string>`), exports `MessageKey = keyof typeof enShape`, and keeps the default export typed `Record<string, string>`.
- Each `es/<area>.ts` is typed `Record<keyof typeof en<Area>, string>` through a type-only import of the matching en area, so a missing or extra key fails `tsc` in the area file that is wrong.
- `dictionaries.test.ts` holds an `AREA_PREFIXES` map (area to key prefixes). Tests check that no key is defined in two areas and that every key sits in the area owning its prefix, alongside the existing en/es parity tests.

Rule for new text: add the key to the matching area file in both folders, and register any new prefix in `AREA_PREFIXES`.

## Alternatives considered

- **One file per locale (status quo):** rejected, too large to read or edit.
- **Type only `es/index.ts` against `MessageKey`:** rejected. A missing key would be reported in `index.ts`, and an extra key in an area file would not be caught at all, because spreads skip excess-property checks.
- **Nested objects per area** (`en.nav.catalog`): rejected, it changes the `MessageKey` shape and every call site, which is not a pure refactor.
- **Per-area exported key types:** unnecessary, `keyof typeof` on a type-only import gives the same check with no extra names.

## Consequences

- Files are small and parity errors point at the right file. `MessageKey` is unchanged, so call sites are untouched.
- `Object.keys(en)` order changes (areas are spread in a fixed order, so e.g. `ui.*` now sits with `nav.*`). Nothing depends on it.
- A new prefix needs a registration in `AREA_PREFIXES`, or the placement test fails.
- This refines [2026-07-26-dependency-free-i18n](2026-07-26-dependency-free-i18n.md): its file layout and the "add to `en.ts` and `es.ts`" consequence are out of date. Its decision (no library, flat dot keys, compile-time parity, English default) still holds and it stays Accepted.
