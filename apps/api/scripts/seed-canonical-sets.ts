import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
// Declaring the same @prisma/client version apps/api already generates lets this
// script use the real generated client directly (see plan.md § Approach step 2) --
// unlike scripts/import-catalog, this file lives inside apps/api, so no cross-package
// import workaround is needed here.
import { PrismaClient } from '@prisma/client';

const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'seed', 'templates');

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

// A structural subset of PrismaClient -- lets tests pass a plain mock object with
// only these three properties instead of a full PrismaClient (and no `as any` cast).
export type SeedPrismaClient = Pick<PrismaClient, 'coin' | 'canonicalSet' | 'canonicalSetCoin'>;

export function resolveTemplatePaths(args: string[]): string[] {
  if (args.length > 0) return args.map((arg) => resolve(arg));

  return readdirSync(TEMPLATES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(TEMPLATES_DIR, file));
}

export function parseTemplateVersion(filePath: string): string {
  const base = basename(filePath, '.json');
  const match = base.match(/\.(v\d+)$/);
  if (!match) {
    throw new Error(
      `Template filename must end in a version suffix like ".v1.json" (got: ${filePath})`,
    );
  }
  return match[1];
}

export function loadTemplate(filePath: string): SeedTemplate {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as SeedTemplate;
}

async function upsertCanonicalSet(
  prisma: SeedPrismaClient,
  template: SeedTemplate,
  templateVersion: string,
) {
  const existing = await prisma.canonicalSet.findFirst({ where: { name: template.name } });
  const data = {
    name: template.name,
    description: template.description ?? null,
    source: 'seed-template',
    templateVersion,
  };

  if (existing) {
    return prisma.canonicalSet.update({ where: { id: existing.id }, data });
  }
  return prisma.canonicalSet.create({ data });
}

export async function seedTemplateFile(
  prisma: SeedPrismaClient,
  filePath: string,
): Promise<{ name: string; created: number; updated: number; total: number }> {
  const template = loadTemplate(filePath);
  const templateVersion = parseTemplateVersion(filePath);
  const canonicalSet = await upsertCanonicalSet(prisma, template, templateVersion);

  // Resolve every entry against the catalog before writing anything to
  // CanonicalSetCoin -- fail loudly and stop the whole file's write on the first
  // unresolved coin (system-design_v2.md §4.4/§4.5), rather than partially seeding it.
  const resolvedCoins: Array<{ coinId: string; position: number }> = [];
  for (let index = 0; index < template.coins.length; index++) {
    const entry = template.coins[index];
    const coin = await prisma.coin.findUnique({
      where: {
        country_denomination_year_mintMark_variety: {
          country: entry.country,
          denomination: entry.denomination,
          year: entry.year,
          mintMark: entry.mintMark,
          variety: entry.variety,
        },
      },
    });

    if (!coin) {
      throw new Error(
        `Coin not found for template "${template.name}" (${filePath}) entry ${index}: ` +
          `${entry.country} ${entry.denomination} ${entry.year} mintMark="${entry.mintMark}" variety="${entry.variety}"`,
      );
    }

    resolvedCoins.push({ coinId: coin.id, position: index + 1 });
  }

  const existingRows = await prisma.canonicalSetCoin.findMany({
    where: { canonicalSetId: canonicalSet.id },
  });
  const existingByCoinId = new Map(existingRows.map((row) => [row.coinId, row]));

  const toCreate = resolvedCoins.filter((c) => !existingByCoinId.has(c.coinId));
  let created = 0;
  if (toCreate.length > 0) {
    const result = await prisma.canonicalSetCoin.createMany({
      data: toCreate.map((c) => ({
        canonicalSetId: canonicalSet.id,
        coinId: c.coinId,
        position: c.position,
      })),
      skipDuplicates: true,
    });
    created = result.count;
  }

  let updated = 0;
  for (const c of resolvedCoins) {
    const existingRow = existingByCoinId.get(c.coinId);
    if (existingRow && existingRow.position !== c.position) {
      await prisma.canonicalSetCoin.update({
        where: { id: existingRow.id },
        data: { position: c.position },
      });
      updated++;
    }
  }

  console.log(
    `${template.name} (${filePath}): ${created} coin(s) created, ${updated} position(s) updated, ${template.coins.length} total`,
  );

  return { name: template.name, created, updated, total: template.coins.length };
}

export async function main(): Promise<void> {
  const templatePaths = resolveTemplatePaths(process.argv.slice(2));
  if (templatePaths.length === 0) {
    throw new Error(`No template files found in ${TEMPLATES_DIR}`);
  }

  const prisma = new PrismaClient();
  try {
    // Sequential, not Promise.all: fails loudly and stops on the first bad file
    // rather than partially seeding several at once (system-design_v2.md §4.4/§4.5)
    // -- safe to do because re-running is idempotent (upsert-by-name / natural-key,
    // per file above).
    for (const filePath of templatePaths) {
      await seedTemplateFile(prisma, filePath);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
