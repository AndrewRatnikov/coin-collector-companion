# The missing-coins CSV and print view are built in the browser from the gap data

- **Status:** Accepted
- **Date:** 2026-10-01
- **Source:** orchestrator run `run_20261001_205959` (offline missing-coins list)
- **Code:** `apps/web/src/lib/missing-list.ts`, `apps/web/src/app/sets/[id]/missing/page.tsx`, the `@media print` block in `apps/web/src/app/globals.css`

## Context

Collectors want to take the list of coins they still lack somewhere with no app, such as a coin show. The set editor already loads everything needed through `useSetGaps` (`GET /sets/:id/gaps`).

## Decision

- **No API change.** The pure functions in `missing-list.ts` derive the missing slots (sorted by `position`, input never mutated) and build the CSV:
  - RFC 4180 quoting, CRLF line endings, a UTF-8 BOM so Excel reads it;
  - **formula-injection protection**: any cell starting with `=`, `+`, `-` or `@` gets a leading `'`;
  - fixed English headers, so the file is the same in every UI language;
  - a slugged, local-date filename.
- **Printing uses the browser's print dialog** on a dedicated route, `/sets/[id]/missing`, a compact table. A global `@media print` rule hides `nav`, `footer` and every `button`. No component edits were needed.

## Alternatives considered

- **A server-side export endpoint.** Rejected: the data is already on the client.
- **PDF generation.** Out of scope; the browser can print to PDF.

## Consequences

- The global print rule hides buttons on **every** printed page. This is intended.
- Since `run_20261011_095624`, Download and Print sit in the owner-only ⋯ set-actions menu, so visitors to someone else's set no longer get them. The `/sets/[id]/missing` route itself is unchanged.
