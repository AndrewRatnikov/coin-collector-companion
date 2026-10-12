# Every authenticated request checks that the user still exists

- **Status:** Accepted. Refines `docs/system-design_v2.md` §4.2, where token verification was signature-only.
- **Date:** 2026-10-01
- **Source:** orchestrator run `run_20261001_214421` (finding that resolved the PRD's open question)
- **Code:** `apps/api/src/auth/strategies/jwt.strategy.ts` (`validate`)

## Context

`JwtStrategy.validate` was synchronous and did no database lookup: it mapped `{ sub, email }` to `{ userId, email }`. After an account deletion ([2026-10-01-account-deletion-is-a-hard-delete](2026-10-01-account-deletion-is-a-hard-delete.md)), the user's access token would keep passing the guard until it expired. `GET /auth/me` would then throw Prisma `P2025` and return **500, not 401** (there is no exception filter). Other guarded writes would hit foreign-key errors.

## Decision

`validate` does a primary-key `user.findUnique({ where: { id }, select: { id: true } })` and rejects when the user doesn't exist. Every guarded route then returns 401 for a deleted user. `OptionalJwtAuthGuard` swallows the error, so a deleted user on an optional-auth route is treated as anonymous.

## Alternatives considered

- **A token deny-list, or waiting for the token to expire.** Rejected. A deny-list adds state to maintain, and waiting leaves a window where requests 500.

## Consequences

- One cheap primary-key query per authenticated request, accepted by the PRD. On a Neon cold start it adds latency to the first request.
- The API is no longer purely stateless at the auth layer. This is the same trade-off `RolesGuard` makes in [2026-10-02-in-app-admin-role](2026-10-02-in-app-admin-role.md).
