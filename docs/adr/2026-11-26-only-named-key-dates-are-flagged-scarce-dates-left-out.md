# Only the dates a source names as key dates are flagged and listed; the scarce dates the sources also list are left out

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** orchestrator run `run_20261126_230345` (Morgan and Peace key-date checklists, growth 2.6; the manual key-date files carry an open `recommendation` that the Architect resolved)
- **Code:** `scripts/import-catalog/fixtures/us-dollars-morgan.json`, `scripts/import-catalog/fixtures/us-dollars-peace.json`, `seed/templates/morgan-dollars-key-dates.v2.json`, `seed/templates/peace-dollars-key-dates.v1.json`, `seed/templates/morgan-dollars-key-dates.v1.json`

## Context

Morgan had one flagged coin (1893-S) and Peace none. The committed manual key-date files list, besides the key dates, further scarce dates (nine for Morgan, three for Peace). Treating scarce as key would widen the checklists, but the key-date ADR flags only coins a source names as key dates.

## Decision

- Morgan: `isKeyDate` is true for 1889-CC and 1893-S, the two coins the manual file names as key dates; `keyDates.coins` is `["1889-CC", "1893-S"]`, in fixture order. The 1895 proof is not a business strike and has no row.
- Peace: `isKeyDate` is true for 1928 only (`mintMark` null), and the fixture gains its first `keyDates` block.
- The scarce dates the files list are neither flagged nor put in a checklist.
- `seed/templates/morgan-dollars-key-dates.v2.json` ("Morgan Dollar Key Dates", 1889-CC then 1893-S) is added beside the untouched v1, which holds 1893-S only; `seed:canonical` seeds the newest version per slug, so no script change is needed. `seed/templates/peace-dollars-key-dates.v1.json` ("Peace Dollar Key Dates") holds the 1928.
- Every `keyDates` coin resolves to exactly one fixture row, and the specs check it.

## Alternatives considered

- **Key plus scarce dates in one checklist** (nine Morgan, three Peace). Lost: it labels scarce coins as key dates under a name that says "Key Dates".
- **A separate scarce-dates checklist.** Lost: not asked for; left for Andrew to decide.
- **Editing v1 in place.** Lost: [2026-11-21-canonical-template-changes-ship-as-a-new-version-file](2026-11-21-canonical-template-changes-ship-as-a-new-version-file.md) requires a new version file for a changed template.

## Consequences

The checklists are short (two Morgan coins, one Peace coin) but each flag traces to a saved source. A user who already has the v1 Morgan checklist gets 1889-CC only when the production seed runs, which stays a pending manual pass under growth 2.9. Adding the scarce dates later means a Morgan v3 or a separate checklist. Dates no committed source names (for example 1893-CC) stay unflagged.
