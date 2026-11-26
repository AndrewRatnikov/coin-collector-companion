import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
// The Prisma 7 client that apps/api generates from its schema.prisma (run
// `pnpm --filter api exec prisma generate` first). This package declares the same Prisma
// versions as apps/api, so the generated code and the adapter agree.
import { PrismaClient } from '../../apps/api/src/generated/prisma/client';
import { sanitizeIdentityField } from '@coin-collector/shared';
import { toImageFields } from './lib/image';
import { toSpecFields } from './lib/specs';
import { chunk, planCoinImport } from './lib/plan';
import type { CoinImportConflict, DesiredCoinRow } from './lib/plan';
import type { RawFixtureFile } from './lib/types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

// 15 columns x 1000 rows stays far below Postgres's 65,535 bind-parameter limit.
const CREATE_CHUNK_SIZE = 1000;
// Room for thousands of per-row updates at Neon round-trip latency (e.g. after a spec
// field is added to every row of a file).
const TRANSACTION_TIMEOUT_MS = 600_000;
// Neon autosuspend wake-up.
const TRANSACTION_MAX_WAIT_MS = 30_000;

// Exactly the natural key, the id, the status (a non-approved coin is a conflict, never
// written) and the ten columns the import writes and compares. No submitter data.
export const EXISTING_COIN_SELECT = {
  id: true,
  status: true,
  country: true,
  denomination: true,
  year: true,
  mintMark: true,
  variety: true,
  name: true,
  imageUrl: true,
  imageSource: true,
  imageLicense: true,
  diameterMm: true,
  weightG: true,
  thicknessMm: true,
  material: true,
  mintage: true,
  isKeyDate: true,
} as const;

// Only what the import uses, so a spec can pass a plain mock.
export type ImportPrismaClient = Pick<PrismaClient, 'coin' | '$transaction'>;

export interface ImportOptions {
  // Read-only pre-flight: run the plan, write nothing, print the same counts.
  check: boolean;
}

export interface FileImportResult {
  name: string;
  filePath: string;
  created: number;
  updated: number;
  unchanged: number;
  conflicts: CoinImportConflict[];
  total: number;
}

// `--check` is the only option; a bare `--` (from `pnpm run import -- ...`) is ignored, and
// any other `--` option is an error, so a typo never runs a real import.
export function parseImportArgs(args: readonly string[]): { check: boolean; fixtureArgs: string[] } {
  let check = false;
  const fixtureArgs: string[] = [];
  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--check') {
      check = true;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg} (the only option is --check)`);
    }
    fixtureArgs.push(arg);
  }
  return { check, fixtureArgs };
}

// Key, coin id and status only: nothing about who submitted it.
export function formatConflict(conflict: CoinImportConflict): string {
  const { country, denomination, year, mintMark, variety } = conflict.key;
  return (
    `conflict: ${country} ${denomination} ${year} mintMark="${mintMark}" variety="${variety}" ` +
    `id=${conflict.id} status=${String(conflict.status)}: not approved, left untouched`
  );
}

export function formatFileSummary(result: FileImportResult, check: boolean): string {
  return (
    `${check ? '[check] ' : ''}${result.name} (${result.filePath}): ${result.created} created, ` +
    `${result.updated} updated, ${result.unchanged} unchanged, ${result.conflicts.length} conflicts, ` +
    `${result.total} total`
  );
}

function resolveFixturePaths(args: string[]): string[] {
  if (args.length > 0) return args.map((arg) => resolve(arg));

  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(FIXTURES_DIR, file));
}

export async function importFixtureFile(
  prisma: ImportPrismaClient,
  filePath: string,
  options: ImportOptions,
): Promise<FileImportResult> {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as RawFixtureFile;

  const desired: DesiredCoinRow[] = raw.coins.map((entry) => ({
    country: raw.country,
    denomination: raw.denomination,
    year: entry.year,
    mintMark: sanitizeIdentityField(entry.mintMark),
    variety: sanitizeIdentityField(entry.variety),
    name: raw.name,
    ...toImageFields(entry.image),
    ...toSpecFields(raw, entry),
  }));

  // One read for the whole file: every coin already stored for its (country, denomination).
  const existing = await prisma.coin.findMany({
    where: { country: raw.country, denomination: raw.denomination },
    select: EXISTING_COIN_SELECT,
  });

  const plan = planCoinImport(desired, existing);

  let created = 0;
  if (options.check) {
    // Read-only pre-flight: report what a real run would create, write nothing.
    created = plan.toCreate.length;
  } else if (plan.toCreate.length > 0 || plan.toUpdate.length > 0) {
    // Nothing to write (e.g. a re-run on an imported database): open no transaction at all.
    // Conflicts are in neither list, so a non-approved coin is never written.
    // All writes go through `tx`, so a throw rolls back the whole file.
    await prisma.$transaction(
      async (tx) => {
        for (const rows of chunk(plan.toCreate, CREATE_CHUNK_SIZE)) {
          created += (await tx.coin.createMany({ data: rows, skipDuplicates: true })).count;
        }
        for (const update of plan.toUpdate) {
          await tx.coin.update({ where: { id: update.id }, data: update.data });
        }
      },
      { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  const result: FileImportResult = {
    name: raw.name,
    filePath,
    created,
    updated: plan.toUpdate.length,
    unchanged: plan.unchanged.length,
    conflicts: plan.conflicts,
    // Distinct natural keys in the file, conflicts included.
    total:
      plan.toCreate.length + plan.toUpdate.length + plan.unchanged.length + plan.conflicts.length,
  };
  for (const conflict of plan.conflicts) console.warn(formatConflict(conflict));
  console.log(formatFileSummary(result, options.check));
  return result;
}

// Returns the process exit code: 1 when any file had a conflict, so the operator notices.
export async function runImport(
  prisma: ImportPrismaClient,
  fixturePaths: readonly string[],
  options: ImportOptions,
): Promise<number> {
  let conflicts = 0;
  let filesWithConflicts = 0;
  // Sequential, not Promise.all: fails loudly and stops on the first bad file rather
  // than partially importing several at once (system-design_v2.md §4.3/§4.5) — safe
  // to do because re-running is idempotent: each file is diffed against the database by
  // natural key and only the difference is written, in one transaction per file.
  // Conflicts don't stop anything: the rest of the file and later files are still written.
  for (const filePath of fixturePaths) {
    const result = await importFixtureFile(prisma, filePath, options);
    conflicts += result.conflicts.length;
    if (result.conflicts.length > 0) filesWithConflicts += 1;
  }

  if (conflicts > 0) {
    console.error(
      `${conflicts} conflicts in ${filesWithConflicts} files: those non-approved coins were left ` +
        'untouched. Resolve them in /admin/submissions (see scripts/import-catalog/README.md) and re-run.',
    );
    return 1;
  }
  return 0;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  // Parse first: an unknown option fails before any fixture is read or any client is built.
  const { check, fixtureArgs } = parseImportArgs(argv);
  const fixturePaths = resolveFixturePaths(fixtureArgs);
  if (fixturePaths.length === 0) {
    throw new Error(`No fixture files found in ${FIXTURES_DIR}`);
  }

  // Prisma 7 neither loads .env nor connects without a driver adapter: read apps/api/.env
  // when it exists (environment variables take precedence), then connect through PrismaPg.
  const envFile = join(__dirname, '..', '..', 'apps', 'api', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    return await runImport(prisma, fixturePaths, { check });
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly, so specs can import the functions above.
if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
