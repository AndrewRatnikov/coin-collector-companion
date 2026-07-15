/**
 * Loads seed/templates/*.json into CollectionSet/SetSlot (PRD §6.4, SD §6).
 *
 * Two passes on purpose: every file is parsed and validated *before* any
 * database write happens, so a single malformed template aborts the whole
 * run instead of leaving earlier templates seeded and later ones missing
 * ("fail the whole run loudly on a malformed file" — backlog 3.1).
 *
 * Slots are diffed against the DB in script code, not via Prisma's
 * `upsert`, because Postgres treats NULL as distinct from NULL in unique
 * constraints — a naive upsert on (setId, year, mintMark, label) would
 * never match an existing Philadelphia (mintMark: null) slot and would
 * insert a duplicate every run. Matched slots keep their row id (so
 * CoinItem.slotId links survive); only slots absent from the JSON are
 * deleted, never the whole set.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Denomination, PrismaClient } from '@prisma/client';

const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'seed', 'templates');
const VALID_DENOMINATIONS = new Set<string>(Object.values(Denomination));

interface TemplateSlot {
  year: number;
  mintMark: string | null;
  label: string | null;
  sortOrder: number;
  isKeyDate: boolean;
}

interface Template {
  name: string;
  category: string;
  denomination: Denomination;
  slots: TemplateSlot[];
}

class MalformedTemplateError extends Error {
  constructor(fileName: string, reason: string) {
    super(`Malformed template "${fileName}": ${reason}`);
    this.name = 'MalformedTemplateError';
  }
}

function slotKey(slot: Pick<TemplateSlot, 'year' | 'mintMark' | 'label'>): string {
  return `${slot.year}::${slot.mintMark ?? '\0'}::${slot.label ?? '\0'}`;
}

function assert(condition: boolean, fileName: string, reason: string): asserts condition {
  if (!condition) {
    throw new MalformedTemplateError(fileName, reason);
  }
}

function parseTemplate(fileName: string, raw: unknown): Template {
  assert(typeof raw === 'object' && raw !== null, fileName, 'root value must be an object');
  const data = raw as Record<string, unknown>;

  assert(
    typeof data.name === 'string' && data.name.trim().length > 0,
    fileName,
    '"name" must be a non-empty string',
  );
  assert(
    typeof data.category === 'string' && data.category.trim().length > 0,
    fileName,
    '"category" must be a non-empty string',
  );
  assert(
    typeof data.denomination === 'string' && VALID_DENOMINATIONS.has(data.denomination),
    fileName,
    `"denomination" must be one of ${[...VALID_DENOMINATIONS].join(', ')}`,
  );
  assert(
    Array.isArray(data.slots) && data.slots.length > 0,
    fileName,
    '"slots" must be a non-empty array',
  );

  const seenKeys = new Set<string>();
  const slots: TemplateSlot[] = (data.slots as unknown[]).map((rawSlot, index) => {
    assert(
      typeof rawSlot === 'object' && rawSlot !== null,
      fileName,
      `slots[${index}] must be an object`,
    );
    const slot = rawSlot as Record<string, unknown>;

    assert(
      typeof slot.year === 'number' && Number.isInteger(slot.year),
      fileName,
      `slots[${index}].year must be an integer`,
    );
    assert(
      'mintMark' in slot && (slot.mintMark === null || typeof slot.mintMark === 'string'),
      fileName,
      `slots[${index}].mintMark must be present and be a string or null (never "P" for no mint mark)`,
    );
    assert(
      slot.label === undefined || slot.label === null || typeof slot.label === 'string',
      fileName,
      `slots[${index}].label must be a string or null when present`,
    );
    assert(
      typeof slot.sortOrder === 'number' && Number.isInteger(slot.sortOrder),
      fileName,
      `slots[${index}].sortOrder must be an integer`,
    );
    assert(
      typeof slot.isKeyDate === 'boolean',
      fileName,
      `slots[${index}].isKeyDate must be a boolean`,
    );

    const parsed: TemplateSlot = {
      year: slot.year as number,
      mintMark: (slot.mintMark as string | null) ?? null,
      label: (slot.label as string | null | undefined) ?? null,
      sortOrder: slot.sortOrder as number,
      isKeyDate: slot.isKeyDate as boolean,
    };

    const key = slotKey(parsed);
    assert(
      !seenKeys.has(key),
      fileName,
      `duplicate slot natural key (year=${parsed.year}, mintMark=${parsed.mintMark}, label=${parsed.label}) at slots[${index}]`,
    );
    seenKeys.add(key);

    return parsed;
  });

  return {
    name: data.name as string,
    category: data.category as string,
    denomination: data.denomination as Denomination,
    slots,
  };
}

async function loadTemplates(): Promise<{ fileName: string; template: Template }[]> {
  const entries = await readdir(TEMPLATES_DIR);
  const fileNames = entries.filter((name) => name.endsWith('.json')).sort();

  if (fileNames.length === 0) {
    console.warn(`No template JSON files found in ${TEMPLATES_DIR} — nothing to seed.`);
  }

  return Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(TEMPLATES_DIR, fileName);
      const contents = await readFile(filePath, 'utf-8');

      let raw: unknown;
      try {
        raw = JSON.parse(contents);
      } catch (err) {
        throw new MalformedTemplateError(
          fileName,
          `invalid JSON (${err instanceof Error ? err.message : String(err)})`,
        );
      }

      return { fileName, template: parseTemplate(fileName, raw) };
    }),
  );
}

async function seedTemplate(
  prisma: PrismaClient,
  fileName: string,
  template: Template,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      let set = await tx.collectionSet.findFirst({
        where: { name: template.name, isTemplate: true },
      });

      if (set) {
        set = await tx.collectionSet.update({
          where: { id: set.id },
          data: { category: template.category, denomination: template.denomination },
        });
      } else {
        set = await tx.collectionSet.create({
          data: {
            name: template.name,
            category: template.category,
            denomination: template.denomination,
            isTemplate: true,
            ownerId: null,
          },
        });
      }

      const existingSlots = await tx.setSlot.findMany({ where: { setId: set.id } });
      const existingByKey = new Map(existingSlots.map((slot) => [slotKey(slot), slot]));
      const incomingKeys = new Set(template.slots.map(slotKey));

      let created = 0;
      let updated = 0;
      let deleted = 0;

      for (const incoming of template.slots) {
        const key = slotKey(incoming);
        const existing = existingByKey.get(key);

        if (existing) {
          await tx.setSlot.update({
            where: { id: existing.id },
            data: { sortOrder: incoming.sortOrder, isKeyDate: incoming.isKeyDate },
          });
          updated += 1;
        } else {
          await tx.setSlot.create({
            data: {
              setId: set.id,
              year: incoming.year,
              mintMark: incoming.mintMark,
              label: incoming.label,
              sortOrder: incoming.sortOrder,
              isKeyDate: incoming.isKeyDate,
            },
          });
          created += 1;
        }
      }

      const toDelete = existingSlots.filter((slot) => !incomingKeys.has(slotKey(slot)));
      if (toDelete.length > 0) {
        await tx.setSlot.deleteMany({ where: { id: { in: toDelete.map((slot) => slot.id) } } });
        deleted = toDelete.length;
      }

      console.log(
        `  ${fileName} -> "${template.name}": ${created} slot(s) created, ${updated} updated, ${deleted} deleted`,
      );
    },
    { timeout: 30_000 },
  );
}

async function main(): Promise<void> {
  console.log(`Reading templates from ${TEMPLATES_DIR}`);
  const templates = await loadTemplates();

  const prisma = new PrismaClient();
  try {
    for (const { fileName, template } of templates) {
      await seedTemplate(prisma, fileName, template);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Seed complete: ${templates.length} template(s) processed.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
