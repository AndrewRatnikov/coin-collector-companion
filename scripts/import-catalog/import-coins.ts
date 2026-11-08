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
import type { RawFixtureFile } from './lib/types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function resolveFixturePaths(args: string[]): string[] {
  if (args.length > 0) return args.map((arg) => resolve(arg));

  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(FIXTURES_DIR, file));
}

async function importFixtureFile(prisma: PrismaClient, filePath: string): Promise<void> {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as RawFixtureFile;

  let created = 0;
  let updated = 0;

  for (const entry of raw.coins) {
    const naturalKey = {
      country: raw.country,
      denomination: raw.denomination,
      year: entry.year,
      mintMark: sanitizeIdentityField(entry.mintMark),
      variety: sanitizeIdentityField(entry.variety),
    };
    const imageFields = toImageFields(entry.image);
    const specFields = toSpecFields(raw, entry);

    const existing = await prisma.coin.findUnique({
      where: { country_denomination_year_mintMark_variety: naturalKey },
    });

    if (existing) {
      await prisma.coin.update({
        where: { id: existing.id },
        data: { name: raw.name, ...imageFields, ...specFields },
      });
      updated++;
    } else {
      await prisma.coin.create({
        data: { ...naturalKey, name: raw.name, ...imageFields, ...specFields },
      });
      created++;
    }
  }

  console.log(`${raw.name} (${filePath}): ${created} created, ${updated} updated, ${raw.coins.length} total`);
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
    // to do because re-running is idempotent (upsert-by-natural-key, per file above).
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
