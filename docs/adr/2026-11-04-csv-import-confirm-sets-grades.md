# CSV import confirm takes an optional grades array and overwrites grades, never clearing one

- **Status:** Accepted
- **Date:** 2026-11-04
- **Source:** orchestrator run `run_20261104_064643` (coin grades, phase 4 of 4: CSV import reads grades; "overwrite on import, never wipe" was fixed in the task brief)
- **Code:** `apps/api/src/collection-import/collection-import.service.ts`, `apps/api/src/collection-import/dto/confirm-import.dto.ts`, `apps/api/src/collection-import/import-grades.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/import-selection.ts`, `apps/web/src/app/collection/import/page.tsx`
- **Supersedes:** [2026-10-05-collection-import-preview-then-confirm](2026-10-05-collection-import-preview-then-confirm.md) (only "Confirm takes only `{ coinIds }`" and "Confirm only adds ownership"; the rest stands), [2026-11-02-one-optional-adjectival-grade-per-ownership-row](2026-11-02-one-optional-adjectival-grade-per-ownership-row.md) (only "CSV import never touches grades"; the rest stands)

## Context

Phase 1 stored an optional `Ownership.grade` and said only `PATCH /collection/:coinId` writes it. Spreadsheets often carry a condition column (`Grade`, `Estado`, `Conservación`), so users wanted import to fill grades. The brief fixed two rules: a grade in the file overwrites the stored one, and a blank or unrecognised cell never wipes an existing grade. The 2026-10-05 flow is stateless (the file is never kept), and web (Vercel) and API (Render) deploy separately.

## Decision

- **Mapping and preview.** `grade` is a new `ImportField`. `import-grades.ts` (pure, in the API) maps a trimmed, lower-cased cell to a neutral `CoinGrade` through `GRADE_ALIASES` (English codes, aliases such as `ef`, `bu`, and Spanish abbreviations such as `mbc`, `ebc`). Each preview row carries `grade: CoinGrade | null`.
- **Warnings are preview-only.** The preview response has `warnings: ImportPreviewWarning[]` (`{ line, code: 'grade_not_recognised', value }`), one per non-empty unrecognised cell. Confirm never receives them.
- **Confirm payload.** `ConfirmImportDto` keeps `coinIds` and gains optional `grades: { coinId, grade }[]`, validated per item (`IsUUID`, `IsIn(COIN_GRADES)`), at most `IMPORT_MAX_ROWS`. The service rejects with 400 `IMPORT_INVALID_GRADES` any entry whose `coinId` is not in `coinIds` or that repeats a coin, before any query.
- **Writes.** With no grades the call is the old single `createMany({ skipDuplicates: true })`. With grades, one `$transaction` runs that `createMany`, then one `updateMany` per grade in `COIN_GRADES` (at most 7) for the coins sent with it. This overwrites the grade of coins the user already owned. Only recognised grades are ever sent, so nothing is cleared.
- **Client.** `selectedGrades` in `import-selection.ts` sends, per effective coin, the grade of its first graded row in file order (matching the "first row wins" duplicate convention). The confirm button is enabled when `toImport > 0` or there are grades to set, so re-importing a fully owned file to set grades is reachable. A "Grades to set" count shows when grade is mapped.
- Ownership is still only added, never removed. No schema change (the comment above `Ownership.grade` was updated).

## Alternatives considered

- Replace `coinIds` with `{ coinId, grade? }[]`: breaks the confirm contract during a split deploy.
- Re-parse the file at confirm: the file is not kept, so it would need sessions or a re-upload, which 2026-10-05 rejected.
- A `Record<coinId, grade>` map: `class-validator` cannot validate per key without a custom validator.
- Send `grade: null` for blank or unknown rows: invites a wipe bug and breaks the no-wipe rule.
- `upsert` per coin: up to 2,000 queries instead of at most 7 `updateMany`s.
- A per-row `gradeWarning` field: cannot carry other warning kinds; last-row-wins for duplicate coins: contradicts first-row-wins.

## Consequences

- Backward compatible: a request without `grades` is the old request with the same database calls. An old API silently strips `grades` (`whitelist: true`), so deploying web first just imports without grades. Deploy API first.
- Re-confirming the same file is no longer a no-op when it has grades: it rewrites them. Ownership stays idempotent.
- Import is now a second grade write path next to `PATCH /collection/:coinId`, and it can overwrite a grade the user set by hand.
- Matching is exact after trim and lower-case: `MS-65`, `Proof`, `AG` are warnings, not grades. `estado` is a generic Spanish word, so a US-state column can get a grade suggestion; the user sets it to Not mapped.
- Revisit if import needs to clear grades, or if more warning kinds arrive (the coded list is built for that).
