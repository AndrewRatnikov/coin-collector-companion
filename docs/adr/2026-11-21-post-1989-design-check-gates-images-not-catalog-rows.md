# The per-design check for US designs from March 1989 onward gates images only; catalog rows for those designs are imported without it

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_211337` (modern Washington quarter fixtures and templates, growth 2.5; the task told the run to say the per-design check decides images, not catalog rows, citing `docs/catalog-expansion-research.md` Licensing item 1)
- **Code:** `docs/catalog-data-licensing.md`, `CLAUDE.md`, `seed/templates/50-state-quarters.v1.json`, `scripts/import-catalog/fixtures/us-quarters-50-state.json`
- **Supersedes:** `docs/catalog-data-licensing.md` §3 (State Quarters sentence) and "Net result" ("Not cleared yet" item), `CLAUDE.md` "Rules that are easy to break" (license gate line)

## Context

`docs/catalog-data-licensing.md` marked State Quarters (1999-2008) "not cleared yet", and the `CLAUDE.md` rule said US designs from March 1989 onward need a per-design check before a catalog import. Read that way, it blocks every modern US series, including the 286 quarter rows of growth 2.5 (and the later modern parts of 2.2-2.4). The check itself (Commons: Determining if U.S. coins are free to use) is about whether a picture of a design is copyrighted, because Artistic Infusion and outside designers are contractors. A row holds year, mint mark, variety and mintage, none of which carries design expression. This run had no images.

## Decision

The per-design employee-vs-contractor check decides **images only**. Catalog rows for post-March-1989 US designs (identity facts and mintages) are imported without it, because they are facts whichever way the design is licensed (the reasoning in `docs/catalog-data-licensing.md` §1 and `docs/catalog-expansion-research.md` Licensing item 1). An image of such a design still needs the per-design check plus the per-file Commons `extmetadata` gate (§2) before it is shown. Pre-1989 designs keep the blanket public-domain pass. `docs/catalog-data-licensing.md` §3 and "Net result" and the `CLAUDE.md` license-gate line were reworded to say this, and the six quarter programs are listed as cleared for rows.

## Alternatives considered

- **Keep blocking rows until a per-design check is done.** Rejected: the check protects nothing for rows, and it would hold back every modern US series.
- **Run the per-design check now.** Rejected: out of scope, since this run adds no images.

## Consequences

- Later post-1989 US series (dollars, modern cents already imported, nickels, dimes) can be imported as rows without a licensing pass.
- Any run that adds images of these designs must do the per-design check first; nothing in the code enforces that, only the docs and the Commons gate.
- The rule leans on facts not being copyrightable (US law, *Feist*). It does not extend to euro data, which has its own database-right argument in `docs/catalog-expansion-research.md`.
