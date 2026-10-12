# Collection import is a stateless preview-then-confirm flow that only adds ownership

- **Status:** Accepted
- **Date:** 2026-10-05
- **Source:** orchestrator run `run_20261005_212015` (CSV collection import, the first major post-MVP feature in `docs/prd_v2.md`)
- **Code:** `apps/api/src/collection-import/` (`csv-parser.ts`, `column-mapping.ts`, `import-matcher.ts`, `import-aliases.ts`, service, controller, DTOs), `packages/shared` import types, `apps/web/src/app/collection/import/`, `apps/web/src/lib/import-selection.ts`

## Context

Users want to load a collection they already track in a spreadsheet instead of marking hundreds of coins one by one. Real files are messy:

- Excel or Sheets exports, often `;`-delimited with a BOM;
- the user's own column names, plus extra columns;
- spellings that don't match the catalog ("United States", "Wheat penny", "1909-S VDB", Cyrillic);
- duplicate rows.

Constraints: no external services (no Numista), the uploaded file is never stored, and no schema change unless one is unavoidable.

## Decision

- **Two stateless endpoints.**
  - **Preview** takes a multipart upload through Nest's built-in `FileInterceptor` (memory storage; nothing touches disk). It decodes, parses and matches every row, then returns per-row results with a reason code.
  - **Confirm** takes only `{ coinIds: string[] }`. The client keeps the rows, the user's resolutions and the skipped count. Nothing is written before confirm.
- **Matching is server-side and pure:** `import-matcher.ts` and the plain-data alias tables, with no Nest, Prisma or HTTP imports. It runs against an in-memory snapshot of **approved** coins only, read with `CATALOG_COIN_SELECT`. Pending submissions are not matchable, not even the user's own. A user "P" mint mark is treated as `''` when no candidate coin has `P`.
- **Confirm only adds ownership:** `ownership.createMany({ skipDuplicates: true })` on the existing `(userId, coinId)` primary key. Importing the same file twice changes nothing. Import never removes ownership, never edits catalog coins and never touches sets. All ids must be approved coins, or the request is rejected with 400 and nothing is written.
- **Limits:** 1 MB per file (413), 2,000 data rows (400 `IMPORT_TOO_MANY_ROWS`), 2,000 ids per confirm. Throttled at 10 previews and 5 confirms per minute.
- **No Numista preset**, because no verified sample of the export exists. Generic column mapping (with header synonyms and a combined "Coin / description" field) covers a Numista "save as CSV".
- **No schema change.**

## Alternatives considered

- **A JSON upload.** Rejected: Nest's default JSON body limit is 100 kB, and the server needs the raw bytes to reject invalid UTF-8 or binary files.
- **Server-side import sessions** (store the parsed file between preview and confirm). Rejected: they need storage and expiry, and the file must not be kept.
- **Client-side matching.** Not chosen. The catalog would have to be shipped to the browser, and the matcher would be harder to test with the API's data.

## Consequences

- The match rate depends on the alias tables. They were written from expected spellings, not from a real user's file, and are the first place to tune.
- A 2,000-row preview with candidates is a few hundred kB of JSON, which is acceptable for a user-triggered action.
- `apiFetch` skips the JSON `Content-Type` for `FormData` bodies, a change that touches every request path.
