# Repo Digest
_Generated: 2026-07-19T16:14:28Z | Run: run_20260719_190933_

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
(Root `package.json` has no `test` script — this is a pnpm workspace; `apps/api`'s own
`package.json` defines `"test": "jest"` scoped to `src/**/*.spec.ts`, mocked-Prisma unit
tests, no real DB/network. `apps/web` has no test runner configured at all — determined
by the Architect from `apps/api/package.json`/`apps/web/package.json`, not autodetected.)

## Existing source files
### Components (.tsx)
```
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx
apps/web/src/components/auth/form-field.tsx
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
apps/api/src/health/health.controller.spec.ts
apps/api/src/health/health.controller.ts
apps/api/src/main.ts
apps/api/src/prisma/prisma.module.ts
apps/api/src/prisma/prisma.service.ts
apps/api/test/auth.e2e-spec.ts
apps/api/test/health.e2e-spec.ts
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

## Similar existing files (task hint: "Catalog endpoints + Wikipedia attribution footer (backlog_week1.md 5.1-5.2)")
```
apps/api/prisma/migrations/20260719144442_add_catalog_sets_ownership/migration.sql
docs/catalog-data-licensing.md
scripts/import-catalog/fixtures/README.md
scripts/import-catalog/fixtures/us-cents-lincoln-wheat.json
scripts/import-catalog/import-coins.ts
scripts/import-catalog/lib/image.ts
scripts/import-catalog/lib/sanitize.ts
scripts/import-catalog/lib/types.ts
scripts/import-catalog/node_modules/.bin/prisma
scripts/import-catalog/node_modules/.bin/ts-node
scripts/import-catalog/node_modules/.bin/ts-node-cwd
scripts/import-catalog/node_modules/.bin/ts-node-esm
scripts/import-catalog/node_modules/.bin/ts-node-script
scripts/import-catalog/node_modules/.bin/ts-node-transpile-only
scripts/import-catalog/node_modules/.bin/ts-script
scripts/import-catalog/node_modules/.bin/tsc
scripts/import-catalog/node_modules/.bin/tsserver
scripts/import-catalog/package.json
scripts/import-catalog/README.md
scripts/import-catalog/tsconfig.json
```

## Existing test files
```
apps/api/src/health/health.controller.spec.ts
```

