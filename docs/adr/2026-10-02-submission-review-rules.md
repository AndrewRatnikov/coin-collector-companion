# Review decisions are final, rejection reasons are visible only to the submitter, and duplicate warnings are advisory

- **Status:** Accepted
- **Date:** 2026-10-02
- **Source:** orchestrator run `run_20261001_224939` (the user's answers to the five product questions)
- **Code:** `apps/api/src/admin/admin.service.ts`, `apps/api/src/admin/dto/review-coin.dto.ts`, `apps/api/src/catalog/catalog.service.ts` (`CATALOG_COIN_SELECT`, `SUBMITTED_COIN_SELECT`), `apps/web/src/app/catalog/mine/page.tsx`

## Context

With an in-app review flow ([2026-10-02-in-app-admin-role](2026-10-02-in-app-admin-role.md)), five product questions were open: rejection reasons, editing before approval, reversing a decision, notifying the submitter, and duplicate warnings.

## Decision

1. **Rejection reason: optional.** Stored in `Coin.rejectionReason`. It is shown to the submitter in "My submissions". It is **not** added to the public `CATALOG_COIN_SELECT`, because `GET /catalog/:id` is public and returns a coin of any status. A separate `SUBMITTED_COIN_SELECT` is used only on the `submittedByMe` branch.
2. **An admin may edit a submission's fields before approving.** The edit and the decision are one `prisma.coin.update({ where: { id, status: 'pending' } })`. A unique-key clash (`P2002`) returns 409 "A coin with this natural key already exists".
3. **Decisions are final.** `PATCH /admin/coins/:id` on a coin that is no longer pending returns 409 "This coin has already been reviewed" (`P2025`). This also covers two reviewers racing. Approved → rejected and rejected → approved are not offered.
4. **No notification.** Email reaches only the Resend account owner until a sending domain is verified. The status badge in "My submissions" is the signal.
5. **Duplicate warning: advisory.** The review list flags a likely duplicate of an existing approved coin (case-insensitive country and denomination match on the natural key), but it never blocks approval.

## Consequences

- Fixing a wrong decision needs direct database access, as before.
- Edit validation mirrors `POST /catalog`, which has no `@IsNotEmpty` on `country`, `denomination` or `name`, so an admin could blank a field. This was accepted because only the owner is admin.
- The review page shows the first 50 pending submissions (`PENDING_SUBMISSIONS_LIMIT`). Reviewed coins drop out, so the backlog drains without a pager. The API already supports `page`.
