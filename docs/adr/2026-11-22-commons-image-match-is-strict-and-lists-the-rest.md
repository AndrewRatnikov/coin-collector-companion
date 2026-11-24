# A Commons file is written to a fixture only on a strict match; everything else is listed for a human

- **Status:** Accepted
- **Date:** 2026-11-22
- **Source:** orchestrator run `run_20261122_084533` (images for the Ukrainian part of the catalog; the task said ambiguous matches are listed for a human, not guessed)
- **Code:** `scripts/import-catalog/lib/image-match.ts`, `scripts/import-catalog/lib/find-images.ts`, `scripts/import-catalog/lib/image.ts`

## Context

The task said to prefer the reverse (design side) and to list ambiguous matches instead of guessing, but gave no rule for what counts as a match. Ukrainian coins of one denomination and year come in many types (circulation, commemorative, different subjects), and a wrong picture in the catalog is worse than none. Fixtures are committed and later imported to production.

## Decision

`lib/image-match.ts` applies strict rules; the README "Finding images" section lists them as M1 to M8.

- The file's title and parent categories must name the coin's denomination and year.
- A circulation coin ignores commemorative and anniversary files.
- The subject matches only when every meaningful word of the `variety` (or `titleUk`) is present. Files that name another coin of the same year and denomination, across all fixtures given, are dropped. A commemorative needs its subject.
- A circulation year with several coin types and no named type is ambiguous.
- Files outside an aspect ratio of 0.8 to 1.25 (`MIN_ASPECT`, `MAX_ASPECT`), such as obverse and reverse side by side, are left out, because the web app crops to a circle.
- The file must pass `toImageFields` in `lib/image.ts`, imported and unchanged (`docs/catalog-data-licensing.md` §2).
- The reverse wins; any remaining tie is listed, not picked.

The run prints matched, ambiguous and none counts, plus the number of none that were rejected by the licence gate, and lists the ambiguous, gate-rejected and unmatched coins. Coins that already have an image are skipped unless `--overwrite`, which never removes one.

## Alternatives considered

- **A fuzzy similarity score with a threshold.** Rejected: it would always pick a "best" file where a human should choose, which the task forbids.

## Consequences

- Many coins, especially commemoratives without `titleUk`, will come out as "none" or "ambiguous". The lists tell the maintainer where to add an image by hand.
- Because of the commemorative-marker rule, a circulation file named with an anniversary is dropped; this errs on the safe side.
- The matching still lets some wrong files through (for example a same-face-value, same-year silver commemorative), so the fixture diff is reviewed before commit.
- The rules are plain functions with offline specs, so a loosening can be tested against the same recorded responses.
