# Technical Plan: Canonical-set seed templates + admin seed script (Week 2, Day 3)

**Run:** run_20260720_121716
**Date:** 2026-07-20

## Summary

Two new static JSON seed templates under `seed/templates/` (root-level, sibling to `apps/`/`packages/`/`scripts/`/`docs/`) describe canonical-set content built entirely from the 142 Lincoln Wheat Cent coins Week 1's `scripts/import-catalog` already put in Postgres. A new one-off CLI script, `apps/api/scripts/seed-canonical-sets.ts`, reads every template file, resolves each coin entry against the catalog by natural key, and upserts `CanonicalSet`/`CanonicalSetCoin` rows — idempotently, failing loudly on any unresolvable entry. The script mirrors the existing `scripts/import-catalog/import-coins.ts` in structure and fail-stop philosophy, but lives inside `apps/api` (using `apps/api`'s own generated `@prisma/client` directly) per SD §4.4's "apps/api CLI command" framing, and is excluded from the Nest build the same way `prisma/` already is.

## Approach

1. **Author the two template JSON files** (data only, no code) by deriving them from `scripts/import-catalog/fixtures/us-cents-lincoln-wheat.json` — the exact fixture Week 1's import ran against, so every entry is guaranteed to resolve against the real 142-row catalog:
   - `lincoln-wheat-cents.v1.json`: all 142 entries from the fixture, `country: "USA"`, `denomination: "Cent"`, with the fixture's `null` mintMark/variety normalized to `""` (mirroring `sanitizeIdentityField`'s behavior — the fixture is pre-sanitization, the DB rows and this template are post-sanitization).
   - `lincoln-wheat-cents-key-dates.v1.json`: exactly the fixture's 7 entries flagged `isKeyDate: true` — confirmed by inspection: `1909/S/VDB`, `1909/S/""`, `1914/D/""`, `1922/""/"No D"`, `1924/D/""`, `1931/S/""`, `1955/""/"Doubled Die"`.
   - Array order in each file is the position order the seed script will assign (1-indexed: `position = index + 1`).

2. **Write `apps/api/scripts/seed-canonical-sets.ts`**, structured like `import-coins.ts`: a `resolveTemplatePaths(args)` helper (specific `process.argv` paths, or every `*.json` under `seed/templates/` by default), a per-file `seedTemplateFile(prisma, filePath)` function, and a sequential `main()` loop — never `Promise.all` — over the resolved paths, matching the existing fail-stop-not-partial reasoning. Functions take a narrowly-typed Prisma parameter (`Pick<PrismaClient, 'coin' | 'canonicalSet' | 'canonicalSetCoin'>`) rather than a full `PrismaClient`, so tests can pass a plain mock object with only those three properties — no `as any` casts needed. Unlike `import-coins.ts`, the module's top-level `main()` call is guarded behind `require.main === module`, so `seed-canonical-sets.spec.ts` can import the module's exported functions without triggering a real run or instantiating a real `PrismaClient`.

3. **Per-file logic (`seedTemplateFile`):**
   - Parse the template-version suffix from the filename (`lincoln-wheat-cents.v1.json` → `"v1"`); throw if the filename doesn't end in a `.v{N}.json` suffix.
   - Upsert the `CanonicalSet` by `name` (`findFirst` then `create`/`update` — no DB-level unique on `name`, same emulated-upsert pattern already used elsewhere in this codebase's history), setting `source: "seed-template"` and the parsed `templateVersion`.
   - For every coin entry, resolve `prisma.coin.findUnique({ where: { country_denomination_year_mintMark_variety: {...} } })`. If any entry doesn't resolve, throw immediately (stopping the whole run) with an error naming the template, file, and the unresolved natural key — no partial write of `CanonicalSetCoin` rows happens for that file, since all entries are resolved before any `CanonicalSetCoin` write is issued. (The parent `CanonicalSet` row may already have been upserted before a later entry fails — that's fine and expected: the script is idempotent/resumable, so fixing the bad entry and re-running fills in the rest, matching SD §4.3/§4.5's "fail loudly, no partial-import fallback needed" framing already applied to `import-coins.ts`.)
   - Diff resolved coins against the set's existing `CanonicalSetCoin` rows (by `coinId`): `createMany({ data: <new rows>, skipDuplicates: true })` for coins not yet in the set, and an explicit `update` per row whose `position` differs from the template's current order (covers a template author reordering coins between runs) — a coin already present with the same position gets no write, which is what makes the whole script idempotent (0 created, 0 updated on an unchanged re-run).
   - Log one line per file in `import-coins.ts`'s style: `"{name} ({filePath}): {created} coin(s) created, {updated} position(s) updated, {total} total"`.

4. **Wire it up:** add `"scripts"` to `apps/api/tsconfig.build.json`'s `exclude` array (same reason `prisma` is already there — `nest build`'s `rootDir: ./src` program otherwise fails TS6059 on a file outside `src`). Add `"seed:canonical": "ts-node -r tsconfig-paths/register scripts/seed-canonical-sets.ts"` to `apps/api/package.json`. Add a `"roots": ["<rootDir>", "<rootDir>/../scripts"]` entry to the existing `jest` config block in `apps/api/package.json` — jest's `rootDir` there is `src`, so without this, a spec file colocated at `apps/api/scripts/seed-canonical-sets.spec.ts` would never be discovered by `pnpm --filter api test` and would silently never run (a false-pass risk this plan explicitly avoids, given the pipeline's sandbox stage is the only automated gate on this script's logic).

5. **Docs:** check off backlog 3.1–3.4 in `docs/backlog_week2.md`, matching the existing checked-off style (short parenthetical notes, no new headings).

Live-DB verification (running the script against the real Neon dev DB, psql spot-checks, the clone-from-canonical HTTP check, and the deliberate-break check) is **not** part of this plan's automated Coder/sandbox scope — see PRD's process note. That happens as a manual, human-confirmed step after the code lands.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| seed/templates/lincoln-wheat-cents.v1.json | CREATE | Full 142-coin canonical-set template |
| seed/templates/lincoln-wheat-cents-key-dates.v1.json | CREATE | 7-coin key-dates canonical-set template |
| apps/api/scripts/seed-canonical-sets.ts | CREATE | Admin CLI script: loads templates, upserts CanonicalSet/CanonicalSetCoin |
| apps/api/scripts/seed-canonical-sets.spec.ts | CREATE | Unit tests for the script's exported functions (Tester-authored, mocked Prisma) |
| apps/api/tsconfig.build.json | MODIFY | Add `"scripts"` to `exclude` so `nest build` doesn't choke on a file outside `src` (TS6059) |
| apps/api/package.json | MODIFY | Add `seed:canonical` npm script; add jest `roots` entry so `scripts/*.spec.ts` is discovered |
| docs/backlog_week2.md | MODIFY | Check off tasks 3.1–3.4 |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Data files: seed templates

- **Files:** `seed/templates/lincoln-wheat-cents.v1.json`, `seed/templates/lincoln-wheat-cents-key-dates.v1.json`
- **Shape:**
  ```typescript
  interface SeedTemplateFile {
    name: string;
    description?: string;
    coins: Array<{
      country: string;      // "USA"
      denomination: string; // "Cent"
      year: number;
      mintMark: string;     // "" for none — never null
      variety: string;      // "" for none — never null
    }>;
  }
  ```
- `lincoln-wheat-cents.v1.json`: `name: "Lincoln Wheat Cents"`, 142 entries (all fixture entries, `country: "USA"`, `denomination: "Cent"`), array order = intended position order (chronological, ascending year, as in the source fixture).
- `lincoln-wheat-cents-key-dates.v1.json`: `name: "Lincoln Wheat Cent Key Dates"`, exactly these 7 entries in this order:
  1. `{ country: "USA", denomination: "Cent", year: 1909, mintMark: "S", variety: "VDB" }`
  2. `{ country: "USA", denomination: "Cent", year: 1909, mintMark: "S", variety: "" }`
  3. `{ country: "USA", denomination: "Cent", year: 1914, mintMark: "D", variety: "" }`
  4. `{ country: "USA", denomination: "Cent", year: 1922, mintMark: "", variety: "No D" }`
  5. `{ country: "USA", denomination: "Cent", year: 1924, mintMark: "D", variety: "" }`
  6. `{ country: "USA", denomination: "Cent", year: 1931, mintMark: "S", variety: "" }`
  7. `{ country: "USA", denomination: "Cent", year: 1955, mintMark: "", variety: "Doubled Die" }`

### Script: apps/api/scripts/seed-canonical-sets.ts

- **File:** `apps/api/scripts/seed-canonical-sets.ts`
- **Exports** (named, so the spec file can import and unit-test each independently):
  ```typescript
  export interface SeedTemplateCoin {
    country: string;
    denomination: string;
    year: number;
    mintMark: string;
    variety: string;
  }
  export interface SeedTemplate {
    name: string;
    description?: string;
    coins: SeedTemplateCoin[];
  }
  // A structural subset of PrismaClient — lets tests pass a plain mock object.
  export type SeedPrismaClient = Pick<
    import('@prisma/client').PrismaClient,
    'coin' | 'canonicalSet' | 'canonicalSetCoin'
  >;

  export function resolveTemplatePaths(args: string[]): string[];
  // args.length > 0 → args.map(resolve); else every *.json under seed/templates/
  // (join(__dirname, '..', '..', '..', 'seed', 'templates') from apps/api/scripts/).

  export function parseTemplateVersion(filePath: string): string;
  // "lincoln-wheat-cents.v1.json" -> "v1"; throws if no trailing ".v{N}" before ".json".

  export function loadTemplate(filePath: string): SeedTemplate;
  // JSON.parse(readFileSync(filePath, 'utf-8')).

  export async function seedTemplateFile(
    prisma: SeedPrismaClient,
    filePath: string,
  ): Promise<{ name: string; created: number; updated: number; total: number }>;
  // Full per-file logic described in Approach step 3. Throws Error on any
  // unresolved coin.findUnique() before issuing any canonicalSetCoin write.

  export async function main(): Promise<void>;
  // Sequential for-loop over resolveTemplatePaths(process.argv.slice(2)),
  // calling seedTemplateFile for each with a real `new PrismaClient()`,
  // disconnecting in a finally block. Throws if zero template paths resolve.
  ```
- **CLI entrypoint guard:** at the bottom of the file,
  ```typescript
  if (require.main === module) {
    main().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
  ```
  (Not wrapped in the guard in `import-coins.ts` — added here specifically so importing this module in a spec file never triggers a real run.)
- **Dependencies:** `node:fs` (`readdirSync`, `readFileSync`), `node:path` (`join`, `resolve`, `basename`), `@prisma/client`'s `PrismaClient` type only (no runtime `new PrismaClient()` outside `main()`).

### Test file: apps/api/scripts/seed-canonical-sets.spec.ts

Written by the Tester against the contract above — no NestJS `TestingModule` (this isn't a DI-managed class); construct a plain mock object typed `SeedPrismaClient` with `jest.fn()` for `coin.findUnique`, `canonicalSet.findFirst`, `canonicalSet.create`, `canonicalSet.update`, `canonicalSetCoin.findMany`, `canonicalSetCoin.createMany`, `canonicalSetCoin.update`. Required scenarios (map to Acceptance criteria below):

- `parseTemplateVersion`: returns `"v1"` for `"lincoln-wheat-cents.v1.json"` (and a path with directories); throws for a filename with no version suffix.
- `seedTemplateFile` — new `CanonicalSet` (no existing row by name): calls `canonicalSet.findFirst({ where: { name } })`, gets `null`, calls `canonicalSet.create` with `source: "seed-template"` and the parsed `templateVersion`; every coin resolves via `coin.findUnique`; `canonicalSetCoin.findMany` returns `[]` (nothing existing yet); `canonicalSetCoin.createMany` is called once with all resolved coins (`skipDuplicates: true`) and correct 1-indexed `position`s; no `canonicalSetCoin.update` calls; returned `{ created, updated, total }` matches.
- `seedTemplateFile` — existing `CanonicalSet` found by name: `canonicalSet.findFirst` returns a row, `canonicalSet.update` is called (not `create`).
- `seedTemplateFile` — idempotent re-run: `canonicalSetCoin.findMany` returns rows for every resolved coin at the same positions already in the template → `createMany` is not called with any new rows (or called with an empty array) and no `canonicalSetCoin.update` call happens → `{ created: 0, updated: 0 }`.
- `seedTemplateFile` — position changed: `canonicalSetCoin.findMany` returns an existing row for a coin whose stored `position` differs from the template's current index → exactly one `canonicalSetCoin.update` call with the new `position`, and that coin is not passed to `createMany`.
- `seedTemplateFile` — unresolvable coin: `coin.findUnique` resolves `null` for one entry → the function rejects/throws, and neither `canonicalSetCoin.createMany` nor `canonicalSetCoin.update` is ever called (no partial write).
- `resolveTemplatePaths`: given `process.argv`-style args, returns those resolved paths; given no args, returns every `.json` file under the templates directory (mock `readdirSync` and assert it filtered non-`.json` entries).

### Config changes

- `apps/api/tsconfig.build.json`: `"exclude": ["node_modules", "test", "dist", "prisma", "scripts", "**/*spec.ts"]`
- `apps/api/package.json` `"scripts"`: add `"seed:canonical": "ts-node -r tsconfig-paths/register scripts/seed-canonical-sets.ts"`
- `apps/api/package.json` `"jest"`: add `"roots": ["<rootDir>", "<rootDir>/../scripts"]` alongside the existing `moduleFileExtensions`/`rootDir`/`testRegex`/etc. keys.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. lincoln-wheat-cents.v1.json, full 142-coin scope | seed/templates/lincoln-wheat-cents.v1.json (Files changed, Interface Contract §Data files) |
| 2. key-dates template, verified-real subset | seed/templates/lincoln-wheat-cents-key-dates.v1.json, 7 entries confirmed against the fixture's `isKeyDate: true` rows |
| 3. Script exists, excluded from build, runnable via npm script | apps/api/scripts/seed-canonical-sets.ts + tsconfig.build.json exclude + package.json `seed:canonical` |
| 4. Per-file upsert of CanonicalSet + resolve + position-ordered CanonicalSetCoin | seedTemplateFile (Approach step 3, Interface Contract) |
| 5. Fail loudly, stop whole run on unresolved entry | seedTemplateFile's resolve-before-write ordering + spec scenario "unresolvable coin" |
| 6. Idempotent re-run (0 created second time) | seedTemplateFile's existing-row diff logic + spec scenario "idempotent re-run" |
| 7. GET /sets/canonical(/:id) return real seeded data | No code change needed (Day 2 endpoints already read these tables) — verified manually post-seed, per PRD process note |
| 8. Clone-from-canonical matches template exactly | No code change needed (Day 1 clone logic already built) — verified manually post-seed, per PRD process note |
| 9. typecheck/build/test/lint all clean | tsconfig.build.json exclude (build), jest `roots` (test discovers the new spec), no new lint-violating patterns introduced |
| 10. backlog_week2.md 3.1–3.4 checked off | docs/backlog_week2.md (Files changed) |

## Risks and open questions

- **The `CanonicalSet` row can be upserted before all coins in that file resolve.** Documented and accepted in Approach step 3 — consistent with this codebase's existing "fail loudly, resumable, no partial-import fallback" precedent (`import-coins.ts`, SD §4.3/§4.5). Not a defect; re-running after fixing a bad template entry fills in the rest.
- **Jest `roots` config change is new footprint**, not explicitly requested by the task text. Justified because jest's `rootDir: "src"` would otherwise silently never discover `apps/api/scripts/seed-canonical-sets.spec.ts`, defeating this pipeline's TDD/sandbox gate on the very script this task is about. Coder should verify `pnpm --filter api test` output explicitly lists `seed-canonical-sets.spec.ts` as run, not just "0 new failures."
- **`SeedPrismaClient` structural typing** (`Pick<PrismaClient, 'coin' | 'canonicalSet' | 'canonicalSetCoin'>`) is a deliberate deviation from `import-coins.ts`'s `prisma: PrismaClient` parameter — chosen specifically so the Tester's mock object doesn't need a full `PrismaClient` shape or an `as any` cast. `main()` still constructs a real `new PrismaClient()` and passes it in, so this is type-compatible at the real call site (a `PrismaClient` structurally satisfies the `Pick<...>` type).
- Live-DB verification (3.3–3.4's actual Neon dev DB run, psql checks, HTTP clone check, deliberate-break check, cleanup) is explicitly deferred to a human-confirmed manual step after the pipeline completes — see PRD process note. The Coder should not attempt to run `pnpm --filter api run seed:canonical` against a real database as part of this pipeline run.
