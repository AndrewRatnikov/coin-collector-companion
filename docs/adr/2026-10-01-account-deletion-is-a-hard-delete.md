# Account deletion is an immediate hard delete in one transaction; submitted coins stay, anonymised

- **Status:** Accepted
- **Date:** 2026-10-01
- **Source:** orchestrator run `run_20261001_214421` (self-service account deletion)
- **Code:** `apps/api/src/auth/auth.service.ts` and `auth.controller.ts` (`DELETE /auth/account`), `apps/web` `DeleteAccountSection`, `AccountDeletedNotice`, `apps/api/test/account-deletion.e2e-spec.ts`

## Context

There was no user-delete endpoint, only a cleanup script for throwaway test accounts. In `schema.prisma`, `UserSet.user` and `Ownership.user` have no `onDelete` rule (Restrict), so a plain `prisma.user.delete` fails for any user with sets or owned coins. `RefreshToken`, `PasswordResetToken` and `Feedback` cascade. `Coin.submitter` and `UserSet.clonedFromUserSet` are `SetNull`.

## Decision

- `DELETE /auth/account` is guarded, throttled at 5 per minute, and takes `{ password }`. A wrong password returns 401 and never opens the transaction.
- On success, **one interactive Prisma transaction** deletes, in order: the user's `Ownership` rows, then their `UserSet`s (`UserSetCoin` cascades), then the `User` (tokens and feedback cascade). The refresh cookie is cleared and the response is 204.
- The deletes are **explicit, with no schema change**. The `onDelete` rules stay as they are, so a stray `user.delete` elsewhere still fails loudly instead of cascading silently.
- Coins the user submitted stay in the catalog with `submittedByUserId = null`, whatever their status. Other users' clones of the user's sets survive with `clonedFromUserSetId = null`.
- Web: a danger section on Settings → Account. It requires the password and an "I understand this cannot be undone" checkbox, and uses `skipAuthRedirectOn401` so a wrong password shows an inline error. On success it clears the token and the React Query cache and redirects to `/` with a one-time notice (a sessionStorage flag).

## Alternatives considered

- **Add `onDelete: Cascade` to the relations.** Rejected: it needs a migration and makes any future user delete cascade silently.
- **Soft delete, a grace period, data export, or email confirmation.** Out of scope.

## Consequences

- Deletion is immediate and irreversible.
- A deleted user's still-valid access token must stop working. [2026-10-01-jwt-validation-checks-the-user-exists](2026-10-01-jwt-validation-checks-the-user-exists.md) covers how.
