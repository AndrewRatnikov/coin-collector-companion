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
import type { DesiredCoinRow } from './lib/plan';
import type { RawFixtureFile } from './lib/types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

// 15 columns x 1000 rows stays far below Postgres's 65,535 bind-parameter limit.
const CREATE_CHUNK_SIZE = 1000;
// Room for thousands of per-row updates at Neon round-trip latency (e.g. after a spec
// field is added to every row of a file).
const TRANSACTION_TIMEOUT_MS = 600_000;
// Neon autosuspend wake-up.
const TRANSACTION_MAX_WAIT_MS = 30_000;

// Exactly the natural key, the id and the ten columns the import writes and compares.
const EXISTING_COIN_SELECT = {
  id: true,
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

function resolveFixturePaths(args: string[]): string[] {
  if (args.length > 0) return args.map((arg) => resolve(arg));

  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(FIXTURES_DIR, file));
}

async function importFixtureFile(prisma: PrismaClient, filePath: string): Promise<void> {
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
  // Nothing to write (e.g. a re-run on an imported database): open no transaction at all.
  if (plan.toCreate.length > 0 || plan.toUpdate.length > 0) {
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

  const updated = plan.toUpdate.length;
  const unchanged = plan.unchanged.length;
  const total = plan.toCreate.length + plan.toUpdate.length + plan.unchanged.length;
  console.log(
    `${raw.name} (${filePath}): ${created} created, ${updated} updated, ${unchanged} unchanged, ${total} total`,
  );
}

async function main() {
  const fixturePaths = resolveFixturePaths(process.argv.slice(2));
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
    // Sequential, not Promise.all: fails loudly and stops on the first bad file rather
    // than partially importing several at once (system-design_v2.md §4.3/§4.5) — safe
    // to do because re-running is idempotent: each file is diffed against the database by
    // natural key and only the difference is written, in one transaction per file.
    for (const filePath of fixturePaths) {
      await importFixtureFile(prisma, filePath);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
