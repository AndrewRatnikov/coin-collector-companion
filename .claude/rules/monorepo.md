---
paths:
  - "packages/**"
  - "pnpm-workspace.yaml"
  - "**/package.json"
  - "**/tsconfig*.json"
---

# Monorepo and shared package

- **`packages/shared` has no test runner** (no vitest, no `test` script), and its `tsconfig.json` includes all of `src`. A test colocated next to a `packages/shared/src` file breaks `pnpm --filter @coin-collector/shared build` and would never run anyway, because `apps/web`'s vitest doesn't scan `packages/shared`. Put tests for shared exports in a consumer app, e.g. `apps/web/src/lib/`.
- **`packages/shared` is native ESM (`"type": "module"`), and `apps/api` uses plain CJS Jest.** Tests work because `apps/api`'s jest config maps `@coin-collector/shared` to `packages/shared/src/index.ts` and runs those sources through `apps/api/test/support/shared-esm-transformer.js`, which forces a CommonJS transpile for tests only. Keep both entries. Routing shared sources through ts-jest instead fails with `SyntaxError: Unexpected token 'export'`, because NodeNext honours the shared package's own `"type"` field. The same applies to any new ESM workspace package that the api tests import.
- **pnpm blocks native build scripts by default** (`ERR_PNPM_IGNORED_BUILDS`). A new dependency with a postinstall/native build (e.g. esbuild, prisma, bcrypt, sharp) must get an entry under `allowBuilds:` in `pnpm-workspace.yaml`, or `pnpm install` exits non-zero. `minimumReleaseAge: 10080` is also set, so a package version published in the last 7 days won't install.
