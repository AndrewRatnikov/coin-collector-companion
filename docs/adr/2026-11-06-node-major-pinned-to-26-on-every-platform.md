# Node major pinned to 26 on every platform

- **Status:** Accepted
- **Date:** 2026-11-06
- **Source:** orchestrator run `run_20261106_223354` (dependency upgrade, Phase 2 of 7)
- **Code:** `render.yaml`, `.github/workflows/ci.yml`, `package.json`, `.nvmrc`, `apps/web/vitest.config.ts`

## Context

The repo ran Node 22.13.0, pinned exactly, in CI (`.github/workflows/ci.yml`) and on Render (`render.yaml`), while root `package.json` `engines.node` said `>=22.0.0`, with no upper bound. The exact pin missed every Node security release since early 2025. Node 22 reaches end of life on 2027-04-30. Node 26 is the current LTS, supported until 2029-04-30.

## Decision

Every platform runs Node 26, pinned to the major version only, so patch and minor security releases arrive automatically.

- Four places must change together: `render.yaml` `NODE_VERSION` (`'26'`), `.github/workflows/ci.yml` `node-version` (`26`), root `package.json` `engines.node` (`>=26 <27`, bounded so a different major is flagged) and `.nvmrc` (`26`).
- `@types/node` follows the runtime major in every package that declares it (`^26.6.6` in api, web and import-catalog).
- The guard test `apps/web/src/lib/node-version-pins.test.ts` fails if they disagree.

## Alternatives considered

- **Exact patch pin (for example 26.13.0):** reproducible, but it is what left 22.13.0 without security fixes.
- **Staying on Node 22:** end of life on 2027-04-30, so another migration within months.
- **Node 24:** also LTS, and the owner's fallback had a native module failed on 26. It reaches end of life before 26, and bcrypt, sharp and the Prisma engines all load on 26.

## Consequences

- Patch releases are picked up on the next deploy or CI run without a commit, so a broken Node patch can arrive unannounced.
- pnpm only warns on a wrong major (no `engine-strict`); `.nvmrc` and the warning steer developers.
- Node 26's built-in Web Storage global hides jsdom's `localStorage`/`sessionStorage`, so vitest runs its workers with `--no-experimental-webstorage` (`apps/web/vitest.config.ts`). Remove the flag once vitest handles it.
- The Vercel web build's Node version lives in the Vercel project settings, not the repo, and must be set there.
- Moving to Node 28 means changing the four places plus `@types/node` together.
