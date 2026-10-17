# Coin names are built by one shared function, `getCoinName`, returning eyebrow, title and subtitle

- **Status:** Accepted
- **Date:** 2026-10-17
- **Source:** orchestrator run `run_20261017_142658` (signed-in redesign, Phase 1 Foundations). The rule is an Architect interpretation: the brief, PRD and boards disagreed on the 1909-S VDB example.
- **Code:** `packages/shared/src/index.ts` (`getCoinName`), `apps/web/src/lib/get-coin-name.test.ts`, `apps/web/src/components/sets/set-album.tsx`
- **Supersedes:** `docs/design/2026-10-10_album-view.md` (card naming)

## Context

Coin names were built in several places: `getAlbumCardText` for album cards, `formatCoinLabel` for labels, and ad hoc strings in pages. The redesign shows the same three-line name block (eyebrow, title, subtitle) on many screens, so the rule had to live in one place. The redesign brief, the PRD and the Foundations/Components boards disagreed on the 1909-S VDB example. A literal reading of the brief gives an unprefixed variety no "design part", so the title falls to `name`.

## Decision

`getCoinName(coin)` in `packages/shared` returns `{ eyebrow, title, subtitle }`. Missing string fields are treated as empty.

- **Title:** a key date (`isKeyDate`) with no series prefix in `variety` gets a date-style title: the notation (`year`, or `year-mintMark`), followed by the design part of the variety. If the design already contains the year, the design alone is the title. Otherwise the title is the design part, then the type name, then the denomination.
- **Type name:** `name` counts only if something is left after removing country and denomination as whole words.
- **Eyebrow:** the variety's series prefix, else the type name when it differs from the title, else empty.
- **Subtitle:** country, denomination and notation, joined by the shared separator. A part is dropped when the title already contains it as a whole word.

`getAlbumCardText` is gone. `formatCoinLabel` stays only for flat strings (the coin image `alt`, CSV export). The catalog list keeps its own `getCatalogRowText` until Phase 8, so its separate Year column does not double the year. Unit tests are in `apps/web/src/lib/get-coin-name.test.ts`, because `packages/shared` has no test runner (`.claude/rules/monorepo.md`).

## Alternatives considered

- **The literal brief.** It would title 1909-S VDB as "Lincoln Wheat Cent" and every commemorative such as "Antonivskyi Bridge" as "Ukraine Commemorative 10 Hryvnias". Rejected.
- **The board's subtitle "United States · 1 Cent · 1909-S".** The brief and PRD both say the year part is left out when the title already has it. Rejected.
- **Switching the catalog row to `getCoinName` now.** Rejected: it changes catalog tests outside Phase 1 and the layout changes in Phase 8 anyway.

## Consequences

- Every later name block should call `getCoinName` instead of composing strings.
- Real fixtures use `USA` and `Cent`, so a plain cent reads "USA · 1910", not the board's "United States · 1 Cent · 1910".
- If the strict "eyebrow is the variety prefix only" reading is wanted, change the eyebrow step and the 1909-S VDB test. Nothing else depends on it.
- Album card titles are no longer the bare collector notation (such as "1931-S"), which changes the earlier album design.
