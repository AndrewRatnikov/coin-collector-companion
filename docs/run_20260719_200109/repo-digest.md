# Repo Digest
_Generated: 2026-07-19T17:01:45Z | Run: run_20260719_200109_

## Directory tree
```
.
.git
.github
  workflows
    ci.yml
.gitignore
.prettierignore
.prettierrc.json
.vscode
  settings.json
apps
  api
    .env
    .env.example
    dist
    nest-cli.json
    node_modules
    package.json
    prisma
    README.md
    src
    test
    tsconfig.build.json
    tsconfig.json
  web
    .env
    .env.example
    .next
    next-env.d.ts
    next.config.ts
    node_modules
    package.json
    postcss.config.mjs
    README.md
    src
    tsconfig.json
    tsconfig.tsbuildinfo
    vercel.json
CLAUDE.md
docs
  backlog_week1.md
  backlog_week2.md
  build-roadmap.md
  catalog-data-licensing.md
  prd_v2.md
  system-design_v2.md
eslint.config.mjs
LICENSE
node_modules
package.json
packages
  shared
    dist
    node_modules
    package.json
    src
    tsconfig.json
pnpm-lock.yaml
pnpm-workspace.yaml
README.md
render.yaml
scripts
  import-catalog
    fixtures
    import-coins.ts
    lib
    node_modules
    package.json
    README.md
    tsconfig.json
tsconfig.base.json
```

## package.json (scripts + dependencies)
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

## Test command
```
pnpm --filter api test
```
(Corrected — root `package.json` has no `test` script; `apps/api/package.json` has `"test": "jest"` with rootDir `src`, testRegex `.*\.spec\.ts$`, ts-jest. This is a pnpm workspace; run scoped to the `api` workspace member. See memory.md gotcha from run_20260719_190933.)

## Existing source files
### Components (.tsx)
```
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx
apps/web/src/components/auth/form-field.tsx
apps/web/src/components/layout/site-footer.tsx
apps/web/src/components/providers/query-provider.tsx
apps/web/src/components/ui/list-skeleton.tsx
apps/web/src/components/ui/skeleton.tsx
```

### TypeScript files (.ts)
```
apps/api/src/app.module.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/auth.module.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/decorators/current-user.decorator.ts
apps/api/src/auth/decorators/public.decorator.ts
apps/api/src/auth/dto/login.dto.ts
apps/api/src/auth/dto/register.dto.ts
apps/api/src/auth/guards/jwt-auth.guard.ts
apps/api/src/auth/strategies/jwt.strategy.ts
apps/api/src/catalog/catalog.controller.spec.ts
apps/api/src/catalog/catalog.controller.ts
apps/api/src/catalog/catalog.module.ts
apps/api/src/catalog/catalog.service.spec.ts
apps/api/src/catalog/catalog.service.ts
apps/api/src/catalog/dto/find-catalog-query.dto.ts
apps/api/src/health/health.controller.spec.ts
apps/api/src/health/health.controller.ts
apps/api/src/main.ts
apps/api/src/prisma/prisma.module.ts
apps/api/src/prisma/prisma.service.ts
apps/api/test/auth.e2e-spec.ts
apps/api/test/health.e2e-spec.ts
apps/web/.next/dev/types/validator.ts
apps/web/.next/types/validator.ts
apps/web/next.config.ts
apps/web/src/lib/api-client.ts
apps/web/src/lib/form-errors.ts
apps/web/src/lib/query-client.ts
packages/shared/src/index.ts
scripts/import-catalog/import-coins.ts
scripts/import-catalog/lib/image.ts
scripts/import-catalog/lib/sanitize.ts
scripts/import-catalog/lib/types.ts
```

## Similar existing files (task hint: "Implement Day 1 of Week 2 of the Coin Collector Companion backend build: the SetsModule's create/rename/delete/list surface (GET /sets, PATCH /sets/:id, DELETE /sets/:id, POST /sets with clone-from-canonical/clone-from-user support).")
```
apps/web/.next/build/chunks/[root-of-the-server]__0mdq2gk._.js
apps/web/.next/build/chunks/[root-of-the-server]__0mdq2gk._.js.map
apps/web/.next/build/chunks/[root-of-the-server]__1bewiw2._.js
apps/web/.next/build/chunks/[root-of-the-server]__1bewiw2._.js.map
apps/web/.next/dev/build/chunks/[root-of-the-server]__0mdq2gk._.js
apps/web/.next/dev/build/chunks/[root-of-the-server]__0mdq2gk._.js.map
apps/web/.next/dev/build/chunks/[root-of-the-server]__1bewiw2._.js
apps/web/.next/dev/build/chunks/[root-of-the-server]__1bewiw2._.js.map
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0399p0d._.js
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0399p0d._.js.map
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0j-liga._.js
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0j-liga._.js.map
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0tu1-37._.js
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__0tu1-37._.js.map
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__1c63qts._.js
apps/web/.next/dev/server/chunks/ssr/[root-of-the-server]__1c63qts._.js.map
apps/web/.next/dev/static/chunks/[root-of-the-server]__0rt9nip._.css
apps/web/.next/dev/static/chunks/[root-of-the-server]__0rt9nip._.css.map
apps/web/.next/server/chunks/[root-of-the-server]__11adv-4._.js
apps/web/.next/server/chunks/[root-of-the-server]__11adv-4._.js.map
```

## Existing test files
```
apps/api/src/catalog/catalog.controller.spec.ts
apps/api/src/catalog/catalog.service.spec.ts
apps/api/src/health/health.controller.spec.ts
```

