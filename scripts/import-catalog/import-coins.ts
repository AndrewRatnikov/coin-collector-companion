import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Declaring the same @prisma/client/prisma/typescript version ranges as apps/api
// (package.json) makes pnpm dedupe this package's @prisma/client to the identical
// store entry apps/api's own `prisma generate` already populates — so this resolves
// to a real generated client without apps/api having to re-export or re-generate it.
import { PrismaClient } from '@prisma/client';
import { sanitizeIdentityField } from './lib/sanitize';
import { toImageFields } from './lib/image';
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

    const existing = await prisma.coin.findUnique({
      where: { country_denomination_year_mintMark_variety: naturalKey },
    });

    if (existing) {
      await prisma.coin.update({
        where: { id: existing.id },
        data: { name: raw.name, ...imageFields },
      });
      updated++;
    } else {
      await prisma.coin.create({
        data: { ...naturalKey, name: raw.name, ...imageFields },
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

  const prisma = new PrismaClient();
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
