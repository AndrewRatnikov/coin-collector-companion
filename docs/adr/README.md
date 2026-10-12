# Architecture Decision Records

Architecture Decision Records for Coin Collector Companion: one file per decision, named `YYYY-MM-DD-slug.md` after the date it was made.

The nine ADRs below were **backfilled on 2026-10-11** from the AI Orchestrator's run records for runs whose plans never reached `docs/runs/` (which stops at `run_20260804_165504`). Each was checked against the code on `main` at `e5334ca`.

Several of them **supersede positions in [`docs/system-design_v2.md`](../system-design_v2.md)**, which predates them and has not been updated:

| System design says | Now | ADR |
|---|---|---|
| No rate limiting anywhere (§5, §7) | Per-client-IP limits behind Render, with an explicit proxy hop count | [2026-10-01](2026-10-01-rate-limiting-per-client-ip-behind-render.md) |
| JWT check is signature-only (§4.2) | Every authenticated request checks that the user still exists | [2026-10-01](2026-10-01-jwt-validation-checks-the-user-exists.md) |
| Review is a manual database edit, no admin role (§4.7, §6) | In-app admin role, checked from the database per request | [2026-10-02](2026-10-02-in-app-admin-role.md), [2026-10-02](2026-10-02-submission-review-rules.md) |

| Date | Decision | Status |
|---|---|---|
| [2026-07-26](2026-07-26-dependency-free-i18n.md) | The web app uses a dependency-free i18n layer with compile-time key parity | Accepted |
| [2026-10-01](2026-10-01-account-deletion-is-a-hard-delete.md) | Account deletion is an immediate hard delete in one transaction; submitted coins stay, anonymised | Accepted |
| [2026-10-01](2026-10-01-jwt-validation-checks-the-user-exists.md) | Every authenticated request checks that the user still exists | Accepted |
| [2026-10-01](2026-10-01-missing-list-built-in-the-browser.md) | The missing-coins CSV and print view are built in the browser from the gap data | Accepted |
| [2026-10-01](2026-10-01-rate-limiting-per-client-ip-behind-render.md) | Rate limits are per client IP, using an explicit proxy hop count | Accepted |
| [2026-10-02](2026-10-02-in-app-admin-role.md) | Catalog submissions are reviewed in-app by an admin role that is read from the database | Accepted |
| [2026-10-02](2026-10-02-submission-review-rules.md) | Review decisions are final, rejection reasons are visible only to the submitter, and duplicate warnings are advisory | Accepted |
| [2026-10-05](2026-10-05-collection-import-preview-then-confirm.md) | Collection import is a stateless preview-then-confirm flow that only adds ownership | Accepted |
| [2026-10-09](2026-10-09-album-view-client-side-projection.md) | The set Album view is a client-side projection of the gap data, with the view mode kept in the URL | Accepted |

## Where else decisions live

- [`docs/system-design_v2.md`](../system-design_v2.md): the v2 architecture and its trade-off table (§6). This is the baseline the ADRs above amend.
- `docs/runs/<run id>/plan.md`: technical plans for the July and early August orchestrator runs.
- `docs/design/`: visual design briefs (album view, catalog sidebar). The catalog sidebar's API changes (multi-value `denomination`, `keyDateOnly`, `hideOwned`, `sort`, `GET /catalog/facets`) are specified there.
- `CLAUDE.md` and `.claude/rules/*.md`: current architecture summary and easy-to-break rules.

Not written up as ADRs, because they are covered elsewhere or are purely presentational: catalog contributions (`run_20260725_140648`, system design §4.7), variety and link in set coin lists (`run_20261006_215558`), album card redesign (`run_20261010_083926`), and the album and catalog redesigns (`run_20261011_095624` and `run_20261011_105146`, `docs/design/`).

## Adding a new ADR

The orchestrator writes ADRs for its runs (stage 6d, `orch-adr-writer`). To add one by hand,
copy an existing file. Name it `YYYY-MM-DD-short-slug.md` (the date the decision was made,
lowercase kebab-case slug) and add a row to the table above.

```markdown
# <the decision, stated as a sentence>

- **Status:** Accepted | Superseded by [YYYY-MM-DD-slug](YYYY-MM-DD-slug.md)
- **Date:** YYYY-MM-DD
- **Source:** <run id, PR or discussion>
- **Code:** <main files>

## Context
## Decision
## Alternatives considered
## Consequences
```

Don't edit an accepted ADR's decision. Write a new ADR that supersedes it, and change only
the old one's Status line.
