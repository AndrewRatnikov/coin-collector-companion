# Prisma 7 with the pg driver adapter: a CommonJS client generated into apps/api, configured by prisma.config.ts

- **Status:** Accepted
- **Date:** 2026-11-08
- **Source:** orchestrator run `run_20261108_081744` (dependency upgrade, Phase 7 of 7)
- **Code:** `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/scripts/`, `scripts/import-catalog/import-coins.ts`, `apps/api/tsconfig.build.json`, `.gitignore`

## Context

The api ran Prisma 6.19.3, the last 6.x, with the `prisma-client-js` generator: the client was generated into `node_modules/.prisma/client`, imported from `@prisma/client`, connected through Prisma's Rust query engine, and read `DATABASE_URL` from `schema.prisma`'s datasource, loading `apps/api/.env` on its own. Prisma 7 removes or deprecates each of these. The `output` path is required, the datasource URL moves to a Prisma config file, every client needs a driver adapter, `.env` files are no longer loaded, and `migrate diff --from-url` is gone. Prisma 6.19.3's `@prisma/config` also pinned the vulnerable `deepmerge-ts` 7.1.5, which needed a pnpm override ([2026-11-07-pnpm-overrides-for-multer-and-deepmerge-ts.md](2026-11-07-pnpm-overrides-for-multer-and-deepmerge-ts.md)).

The upgrade had fixed limits: Node 26, TypeScript 6.0, NestJS 12, and the api stays CommonJS. The official upgrade guide also tells projects to switch to ESM, which was out of scope.

## Decision

Prisma 7.10.1 (`prisma`, `@prisma/client` and `@prisma/adapter-pg`, all `^7.10.1`, in `apps/api` and `scripts/import-catalog`), set up as the v6 to v7 guide describes, except for the module format:

- **Generator:** `provider = "prisma-client"`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`, `importFileExtension = ""`. The client is TypeScript inside `apps/api/src`, so `nest build` compiles it into `dist/generated/prisma` and Render runs it with no extra step. CommonJS output with extensionless imports works under the api's unchanged `module: NodeNext` tsconfig, with ts-jest and Jest's resolver, and with ts-node for the scripts.
- **Imports:** everything imports from the generated `client` module (`PrismaClient`, `Prisma`, model types, enums). Services and specs share that one module, so `instanceof Prisma.PrismaClientKnownRequestError` matches the errors the client throws (P2002 to 409, P2003, P2025).
- **Generated output is git-ignored** (`apps/api/src/generated/`), like `dist/` and `packages/shared/dist/`, and also ignored by ESLint and Prettier. CI, Verify and Render already run `prisma generate` before typecheck, tests and build.
- **`apps/api/prisma.config.ts`** sets `schema: 'prisma/schema.prisma'`, `migrations.path: 'prisma/migrations'` and `datasource.url: process.env.DATABASE_URL`. It loads `apps/api/.env` with Node's built-in `process.loadEnvFile` when the file exists, and variables already in the environment take precedence. No `dotenv` dependency. `schema.prisma`'s datasource keeps only `provider`. `tsconfig.build.json` excludes the file, like `prisma/` and `scripts/`, because it sits outside `src`.
- **Driver adapter:** `PrismaService` calls `super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`. Nest's `ConfigModule` has loaded `.env` by then. The lifecycle stays as it was (`$connect` on init, `$disconnect` on shutdown). The adapter keeps node-postgres's pool defaults. The three api scripts and `import-catalog` load `apps/api/.env` the same way and build their own client with the same adapter.
- **CLI:** `migrate deploy` is unchanged. The drift check is `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`.
- **pnpm:** `allowBuilds` keeps `prisma` (preinstall Node check) and `@prisma/engines` (postinstall that downloads the schema engine for Migrate). `@prisma/client` 7 has no install script, so its entry becomes `false`. Removing it outright makes `pnpm install` fail once with `ERR_PNPM_IGNORED_BUILDS` on any checkout that still has Prisma 6's `node_modules`. `@prisma/config` 7.10.1 depends on `deepmerge-ts` 8.0.2, so the deepmerge-ts override is removed.

## Alternatives considered

- **Switch the api to ESM, as the guide suggests:** forbidden for this upgrade. Nest 12, Jest 30 and ts-jest run CommonJS here, and nothing in Prisma 7 requires ESM once `moduleFormat = "cjs"` is set.
- **Keep `prisma-client-js`:** it still exists in 7.x but is deprecated and scheduled for removal, and it would leave the upgrade half done.
- **Generate outside `src` (e.g. `apps/api/generated`) or into `node_modules`:** outside `src` breaks `nest build`'s `rootDir`, and the guide no longer supports `node_modules` output.
- **Commit the generated client:** about 840 kB of generated code that would drift from the schema. The repo already regenerates in every pipeline.
- **`dotenv` in `prisma.config.ts` and the scripts:** a new dependency where Node 26's `process.loadEnvFile` does the same.
- **`.config/prisma.ts` instead of `prisma.config.ts`, to avoid the `tsconfig.build.json` exclude:** Prisma accepts it, but it is hidden, TypeScript would never type-check it, and the guide and docs name `prisma.config.ts`.
- **Match Prisma 6's 5-second connect timeout in the adapter:** a behaviour choice the guide leaves to the project. The pg default (no timeout) is more forgiving of Neon cold starts, so it was left as is.

## Consequences

- `prisma generate` is required after every install and schema change. A missing client shows up as `Cannot find module '../generated/prisma/client'` in typecheck, build and api tests.
- Queries now run through node-postgres. TLS follows the connection string (`sslmode=require` on Neon), and pg verifies certificates, where Prisma 6 did not. Pool size and timeouts are node-postgres defaults.
- The Rust query engine and its `allowBuilds` download are gone. The Prisma CLI's dev-only dependency tree grows (Studio, `@prisma/dev`, `mysql2` and `postgres` drivers), but `pnpm audit --prod` stays clean.
- Prisma 7.10.1's preinstall prints "Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+" on Node 26, because its check lists majors 20, 22 and 24 only. It is a warning, `engines` (`>=24.0`) accepts 26, and every check passes on 26.13.0.
- `.claude/verify.json`'s drift step uses the v7 flags. Prisma 7 rejects the old `--from-url` command.
- Prisma 8 (a release candidate on 2026-11-08) is a separate, later upgrade.
