# Catalog submissions are reviewed in-app by an admin role that is read from the database

- **Status:** Accepted. Supersedes "Review, v1: manual, direct-to-database, no admin role or endpoint" in `docs/system-design_v2.md` §4.7 and the matching rows in §6 and §7.
- **Date:** 2026-10-02
- **Source:** orchestrator run `run_20261001_224939` (admin role and submission review page)
- **Code:** `apps/api/prisma/schema.prisma` (`enum Role`, `User.role`), migration `20261001230000_add_user_role_and_rejection_reason`, `apps/api/src/auth/decorators/roles.decorator.ts`, `apps/api/src/auth/guards/roles.guard.ts`, `apps/api/scripts/set-user-role.ts`, `GET/PATCH /admin/coins`, `apps/web/src/app/admin/submissions/`

## Context

User-submitted coins were approved by editing the database by hand in Prisma Studio. The system design deliberately deferred an admin API until volume justified it. The owner decided to bring review into the app.

## Decision

- **The admin area lives inside the existing app** (no separate admin site).
- `enum Role { user admin }`, with `User.role` defaulting to `user`. Existing users become `user` through the migration default.
- **`@Roles('admin')` + `RolesGuard`** protect admin routes. The guard **reads the role from the database on each request** (`select: { role: true }`), not from the JWT, so a demotion takes effect immediately. Anonymous callers get 401 from the global `JwtAuthGuard`, and non-admins get 403. `JwtStrategy` stays untouched: the role lookup happens only on admin routes.
- **No UI or API to grant roles.** The owner runs `apps/api/scripts/set-user-role.ts <email> <role>` by hand.
- Web: `/admin/submissions` lists pending coins. The `SiteNav` admin link appears only when `/auth/me` reports `role: 'admin'`, and the page handles 403 cleanly.

## Alternatives considered

- **Keep reviewing by hand in the database** (the previous decision). Retired by the owner.
- **Put the role in the JWT.** Rejected: a demotion would last until the token expires.

## Consequences

- One extra primary-key query per admin request.
- Role management needs shell and database access. That's fine with a single owner, and worth revisiting if more reviewers appear.
- [2026-10-02-submission-review-rules](2026-10-02-submission-review-rules.md) covers how review decisions themselves behave.
