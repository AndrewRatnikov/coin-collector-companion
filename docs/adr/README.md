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
| [2026-10-09](2026-10-09-album-view-client-side-projection.md) | The set Album view is a client-side projection of the gap data, with the view mode kept in the URL | Superseded by 2026-10-17 |
| [2026-10-13](2026-10-13-new-set-created-in-one-request.md) | Creating a set is one request; coins are picked afterwards in the set editor | Accepted |
| [2026-10-13](2026-10-13-set-list-endpoints-return-flat-coin-count.md) | Set list endpoints return a flat coinCount from Prisma _count | Accepted |
| [2026-10-16](2026-10-16-security-floors-enforced-by-lockfile-test.md) | Security version floors are enforced by a unit test that parses pnpm-lock.yaml | Accepted |
| [2026-10-17](2026-10-17-coin-name-from-one-shared-function.md) | Coin names are built by one shared function, `getCoinName`, returning eyebrow, title and subtitle | Accepted |
| [2026-10-17](2026-10-17-optimistic-ownership-toggle.md) | Ownership toggles are optimistic through the existing `useSetOwnership` mutation, with snapshot rollback | Accepted |
| [2026-10-17](2026-10-17-bulk-ownership-endpoint.md) | Bulk ownership changes go through one idempotent `PATCH /collection` request and a hook that shares the single-coin cache patching | Accepted |
| [2026-10-17](2026-10-17-set-page-album-default-year-groups.md) | The set page defaults to Album and shows both views as year groups, replacing the country/mint-mark album pages | Accepted |
| [2026-10-18](2026-10-18-user-set-list-returns-progress-per-set.md) | GET /sets returns a new UserSetListItem with ownedCount, totalCount and firstMissing, and UserSetSummary stays unchanged | Accepted |
| [2026-10-18](2026-10-18-sets-summary-endpoint-computes-suggestion-server-side.md) | GET /sets/summary returns the unique missing count, collection size and suggested checklist in one server-computed response | Accepted |
| [2026-10-18](2026-10-18-add-coins-sheet-membership-and-count-on-client.md) | The Add coins sheet derives set membership, ownership, hiding and the results count on the client, with no API change | Accepted |
| [2026-10-19](2026-10-19-collection-filtered-and-grouped-on-client.md) | The Collection page filters, counts and groups one unfiltered GET /collection on the client | Accepted |
| [2026-10-19](2026-10-19-removed-coins-stay-visible-via-page-local-list.md) | An un-owned coin stays on the Collection page as "Removed" through a page-local, display-only list | Accepted |

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
