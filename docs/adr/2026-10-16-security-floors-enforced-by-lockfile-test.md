# Security version floors are enforced by a unit test that parses pnpm-lock.yaml

- **Status:** Accepted
- **Date:** 2026-10-16
- **Source:** orchestrator run `run_20261016_225441` (security fix: next 16.4.0 plus in-range handlebars and source-map-js)
- **Code:** `apps/web/src/lib/lockfile-security-floors.test.ts`, `pnpm-lock.yaml`

## Context

This run cleared Next.js advisories and in-range transitive ones. Fixing them needed `next` 16.4.0 (which pulls postcss 8.5.23 and sharp 0.35.x) and newer handlebars and source-map-js. The task forbade `pnpm.overrides`, new dependencies and lowering `minimumReleaseAge`. A later lockfile regeneration could quietly bring a vulnerable copy back, and nothing in the repo would notice.

## Decision

A dependency-free vitest test in the web package reads `pnpm-lock.yaml` and fails if any copy of a floored package is below its floor. It runs in the normal web unit-test step, so Verify and CI cover it offline.

- The `FLOORS` table is `next 16.3.8`, `postcss 8.5.23`, `sharp 0.35.5`, `handlebars 4.7.10`, `source-map-js 1.2.2`.
- The test parses the entry keys of the `packages:` section with a small inline parser (scoped and quoted keys, peer suffixes stripped) and compares versions numerically with an inline function. It checks every version of each name. A package absent from the lockfile passes.
- The failure message names the package, the version found and the floor.
- A sanity test requires more than 100 parsed entries and `next` to be present, so a lockfile format change fails loudly instead of passing vacuously.
- Later security bumps should add their floor to `FLOORS`.

## Alternatives considered

- **`pnpm.overrides`:** forbidden by the task, and it hides the real dependency ranges.
- **`pnpm audit` in CI:** needs network, and it fails on the deferred advisories the repo has accepted (tinypool, vitest, braces and others).
- **A YAML or semver package:** the task forbids new dependencies, so parsing and comparison are inline.

## Consequences

- A lockfile regeneration that reintroduces a vulnerable version fails the web tests, with no network.
- The floors cover only the listed packages. The table must be extended by hand for each new advisory, and it does not replace `pnpm audit`.
- The parser depends on the pnpm lockfile v9 key syntax. A format change will trip the sanity test and need a parser update.
