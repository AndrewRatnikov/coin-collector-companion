# Repo Digest
_Generated: 2026-07-20T04:10:14Z | Run: run_20260720_070901_

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
  run_20260719_190933
    cost.md
    plan.md
    prd.md
    repo-digest.md
    report.md
  run_20260719_200109
    cost.md
    plan.md
    prd.md
    repo-digest.md
    report.md
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
(corrected by Architect — root package.json has no `test` script; `apps/api/package.json` has a real `"test": "jest"` script, run from repo root via the pnpm filter, per the Week 2 Day 1 gotcha in memory.md)

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
apps/api/src/sets/dto/clone-from.dto.ts
apps/api/src/sets/dto/create-set.dto.spec.ts
apps/api/src/sets/dto/create-set.dto.ts
apps/api/src/sets/dto/update-set.dto.spec.ts
apps/api/src/sets/dto/update-set.dto.ts
apps/api/src/sets/sets.controller.spec.ts
apps/api/src/sets/sets.controller.ts
apps/api/src/sets/sets.module.ts
apps/api/src/sets/sets.service.spec.ts
apps/api/src/sets/sets.service.ts
apps/api/src/sets/shared-types.spec.ts
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

## Similar existing files (task hint: "Day 2 Week 2: coin membership on user sets, plus read-only canonical-set and public-set endpoints")
```
apps/api/dist/auth/decorators/current-user.decorator.js
apps/api/dist/auth/decorators/current-user.decorator.js.map
apps/api/prisma/migrations/20260719131351_restore_users_table/migration.sql
apps/api/src/auth/decorators/current-user.decorator.ts
docs/backlog_week1.md
docs/backlog_week2.md
scripts/import-catalog/import-coins.ts
```

## Existing test files
```
apps/api/src/catalog/catalog.controller.spec.ts
apps/api/src/catalog/catalog.service.spec.ts
apps/api/src/health/health.controller.spec.ts
apps/api/src/sets/dto/create-set.dto.spec.ts
apps/api/src/sets/dto/update-set.dto.spec.ts
apps/api/src/sets/sets.controller.spec.ts
apps/api/src/sets/sets.service.spec.ts
apps/api/src/sets/shared-types.spec.ts
```

