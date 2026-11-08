# Two pnpm overrides lift multer to 2.5.0 and deepmerge-ts to 8.x, because their parents pin the vulnerable versions exactly

- **Status:** Accepted. Amended 2026-11-07: the multer override was removed in Phase 6. Amended 2026-11-08: the deepmerge-ts override was removed in Phase 7, so no override remains (see the Updates below).
- **Date:** 2026-11-07
- **Source:** orchestrator run `run_20261107_151225` (dependency upgrade, Phase 3 of 7)
- **Code:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/web/src/lib/lockfile-security-floors.test.ts`

## Context

Phase 3 of the dependency upgrade moves every direct dependency to its newest in-major version that clears the repo's 7-day `minimumReleaseAge`, and refreshes transitive dependencies within their ranges (`pnpm update -r`). Its goal is to clear four production audit findings: body-parser < 2.4.0 and qs <= 6.16.0 (Express's chain), multer < 2.5.0 (Nest's chain) and deepmerge-ts < 8 (Prisma's chain). The task allows `pnpm` overrides for exactly those four packages, and only where an in-range update doesn't clear them.

The in-range refresh clears two of them. express 5.2.1 asks for `body-parser ^2.2.1` and `qs ^6.14.0`, so the lockfile moves to body-parser 2.4.0 and qs 6.17.1 without any override.

It can't clear the other two, because their parents pin the vulnerable version exactly:

- Every `@nestjs/platform-express` 11.x, including 11.2.8 (the newest eligible), depends on `multer` `2.4.0`.
- `@prisma/config` 6.19.3 depends on `deepmerge-ts` `7.1.5`, and Prisma 6.19.3 is the newest 6.x.

No newer Nest 11.x or Prisma 6.x release carries the fix, and moving to Nest 12 or Prisma 7 is a major upgrade that belongs to a later phase.

## Decision

`pnpm-workspace.yaml`, where the repo already keeps `allowBuilds` and `minimumReleaseAge`, gets exactly two version-range overrides, after `minimumReleaseAge: 10080`:

```yaml
# Security overrides only; reasons and removal conditions in
# docs/adr/2026-11-07-pnpm-overrides-for-multer-and-deepmerge-ts.md
overrides:
  'multer@<2.5.0': ^2.5.0
  'deepmerge-ts@<8.0.0': ^8.0.2
```

- **`'multer@<2.5.0': ^2.5.0`** fixes GHSA-q7qp-rjg7-q26m. Reason: `@nestjs/platform-express` 11.x (11.2.8 here) pins `multer` 2.4.0 exactly, so no in-range update can reach 2.5.0. Remove it once `@nestjs/platform-express` itself depends on multer >= 2.5.0.
- **`'deepmerge-ts@<8.0.0': ^8.0.2`** fixes GHSA-ggr8-5vv4-36mx. Reason: `@prisma/config` 6.19.3 pins `deepmerge-ts` 7.1.5 exactly, so no in-range update can reach 8.x. The target is `^8.0.2` rather than `^8.0.0`, because 8.0.2 corrects 8.0.0's Node `engines` field. Remove it once Prisma (Prisma 7, a later phase) depends on deepmerge-ts >= 8 itself.
- The range selectors rewrite only vulnerable copies. Once upstream ships the fix, an entry matches nothing, and it can be deleted with no lockfile change for that package.
- body-parser and qs get no override; the in-range refresh already clears them.
- No `pnpm.overrides` in any `package.json`.
- All four fixed packages get a floor in the lockfile security-floors test (see [2026-10-16-security-floors-enforced-by-lockfile-test.md](2026-10-16-security-floors-enforced-by-lockfile-test.md)): `body-parser 2.4.0`, `multer 2.5.0`, `qs 6.16.1` and `deepmerge-ts 8.0.0`. So deleting an override too early, or any lockfile regeneration that brings a vulnerable copy back, fails the web unit tests. That ADR is not edited; its floor list is extended only through the test.

The resulting lockfile has body-parser 2.4.0, multer 2.5.0, qs 6.17.1 and deepmerge-ts 8.0.2.

## Alternatives considered

- **Wait for upstream:** no Nest 11.x or Prisma 6.x release has the fix, so both high-severity production findings would stay open.
- **Nest 12 or Prisma 7:** major upgrades, which belong to later phases of the upgrade.
- **Unscoped (`multer: 2.5.0`) or parent-scoped (`@nestjs/platform-express>multer`) keys:** they keep forcing a version after upstream catches up. A `<fixed` range selector stops matching on its own.
- **Overrides for body-parser and qs too:** not needed, since the in-range refresh clears them, and the task forbids unneeded overrides.
- **`pnpm.overrides` in `package.json`:** the repo keeps all pnpm settings in `pnpm-workspace.yaml`, which pnpm 11.5.0 reads overrides from.

## Consequences

- Both high-severity production findings in these chains are cleared. Compatibility was checked in a throwaway clone on Node 26.13.0, where install, lint, typecheck, both builds, api unit, web unit, migrate deploy, schema diff and api e2e all passed:
  - **multer 2.5.0** (2026-10-22) is the security fix plus two bug fixes, with the same dependency ranges as 2.4.0. Nest reaches multer only through `FileInterceptor`, which the API doesn't use.
  - **deepmerge-ts 8.0.2:** 8.0's breaking changes concern only `deepmergeInto` aliasing and renamed metadata types. `@prisma/config` 6.19.3 calls plain `deepmerge` once, as c12's `merger` when it loads a `prisma.config.*`, and the repo has no such file. `prisma generate`, `migrate deploy` and `migrate diff` passed, and so did loading a throwaway `prisma.config.ts` through `@prisma/config` with deepmerge-ts 8.0.2.
- pnpm records the block in the lockfile's `overrides:` section, so a `pnpm install --frozen-lockfile` (Verify, CI, Render) fails if `pnpm-workspace.yaml` and the lockfile ever drift apart. Changing an override means regenerating the lockfile.
- pnpm 11 gotcha: after adding or editing `overrides`, `pnpm install` reports "Already up to date" and ignores the change until `node_modules/.pnpm-workspace-state-v1.json` is deleted.
- Each later Nest or Prisma upgrade should check its removal condition above and delete the entry when it holds; the floors keep the fix in place either way.
- Phase 3 also held back versions that were younger than 7 days on 2026-11-07: `@nestjs/swagger` stays at 11.4.7 (11.4.8 published 2026-11-04), `tailwindcss` and `@tailwindcss/postcss` stay at 4.3.3 (4.3.4 on 2026-11-02, 4.3.5 on 2026-11-06), `@tanstack/react-query` goes to 5.105.0 (5.106.0-5.107.1 published 2026-11-04 to 2026-11-06), `supertest` goes to 7.3.1 (7.3.2 published 2026-11-07), and `next` stays at 16.4.3 (16.4.4 on 2026-11-02, 16.4.5 on 2026-11-03). `pnpm audit --prod` still reports one moderate finding, js-yaml 5.3.0 (GHSA-r3ph-w7gj-g6xm), pinned exactly by `@nestjs/swagger` 11.4.7. Its fix comes with swagger 11.4.8, eligible from 2026-11-11, and js-yaml is outside the packages this phase may override, so no override is added for it.

## Update: the multer override is removed (2026-11-07, Phase 6 of 7, NestJS 12)

- **Source:** orchestrator run `run_20261107_181139` (dependency upgrade, Phase 6 of 7)

Phase 6 moves the api to NestJS 12. `@nestjs/platform-express` 12.3.0 and every later 12.x release depend on `multer` `2.5.0` themselves (12.0.0 to 12.2.0 still pinned 2.2.0 to 2.4.0). The lockfile resolves `@nestjs/platform-express` 12.3.2, and `apps/api/package.json` now declares `^12.3.2`, so no version it allows pins a vulnerable multer. That is the removal condition above, so the `'multer@<2.5.0': ^2.5.0` entry is deleted from `pnpm-workspace.yaml`. The lockfile only loses that line of its `overrides:` section; multer stays at 2.5.0, and the `multer 2.5.0` floor in `lockfile-security-floors.test.ts` still guards it.

The `'deepmerge-ts@<8.0.0': ^8.0.2` override stays: Prisma is still 6.19.3, and `@prisma/config` 6.19.3 still pins deepmerge-ts 7.1.5. Its removal condition (Prisma 7) belongs to Phase 7.

Phase 6 also clears the js-yaml finding noted under Consequences: `@nestjs/swagger` 12.0.5 depends on js-yaml 5.5.0, so `pnpm audit --prod` reports no findings.

## Update: the deepmerge-ts override is removed (2026-11-08, Phase 7 of 7, Prisma 7)

- **Source:** orchestrator run `run_20261108_081744` (dependency upgrade, Phase 7 of 7)

Phase 7 moves `apps/api` and `scripts/import-catalog` to Prisma 7.10.1 ([2026-11-08-prisma-7-with-the-pg-driver-adapter.md](2026-11-08-prisma-7-with-the-pg-driver-adapter.md)). `@prisma/config` 7.10.1 depends on `deepmerge-ts` `8.0.2` itself, and both packages declare `prisma` `^7.10.1`, so no Prisma version they allow pins deepmerge-ts 7. That is the removal condition above, so the `'deepmerge-ts@<8.0.0': ^8.0.2` entry is deleted, together with the comment and the now empty `overrides:` key in `pnpm-workspace.yaml`. The lockfile loses its `overrides:` section; deepmerge-ts stays at 8.0.2, the only copy in the tree, and the `deepmerge-ts 8.0.0` floor in `lockfile-security-floors.test.ts` still guards it.

The repo now has no pnpm overrides. A new one needs its own reason and removal condition, recorded the same way.
