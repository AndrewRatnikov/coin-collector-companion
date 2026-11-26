import type { CoinImageFields } from './image';
import type { CoinSpecFields } from './specs';

// Pure planning step of the catalog import: given the coins a fixture file wants and the
// coins already in the database for that file's (country, denomination), decide which rows
// to create, which to update (and with which fields), and which need no write at all.
// A stored coin on a fixture key whose status is not exactly "approved" (a pending or
// rejected user submission, or a missing status) is a conflict: it is never created over or
// updated, only reported, so an admin can decide in /admin/submissions.
// No I/O and no Prisma here, so it can be unit-tested without a database.

// The only status the import may write over. Compared strictly: anything else is a conflict.
export const APPROVED_STATUS = 'approved' as const;

export interface CoinNaturalKey {
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
}

// The columns the import writes and compares. Exactly these ten, nothing else.
export type CoinContentFields = { name: string } & CoinImageFields & CoinSpecFields;

// One coin as the fixture file wants it (the shape passed to createMany as-is).
export type DesiredCoinRow = CoinNaturalKey & CoinContentFields;

// One coin as read from the database. Content fields are optional and nullable so that a
// missing value and null compare equal. `status` decides whether the import may touch it.
export type ExistingCoinRow = { id: string; status: string } & CoinNaturalKey & {
  [K in keyof CoinContentFields]?: CoinContentFields[K] | null;
};

export interface CoinUpdate {
  id: string;
  key: CoinNaturalKey;
  data: Partial<CoinContentFields>;
}

// A stored coin on a fixture key that is not approved: left untouched and reported.
export interface CoinImportConflict {
  key: CoinNaturalKey;
  id: string;
  status: string;
}

export interface CoinImportPlan {
  toCreate: DesiredCoinRow[];
  toUpdate: CoinUpdate[];
  unchanged: ExistingCoinRow[];
  conflicts: CoinImportConflict[];
}

const CONTENT_FIELDS = [
  'name',
  'imageUrl',
  'imageSource',
  'imageLicense',
  'diameterMm',
  'weightG',
  'thicknessMm',
  'material',
  'mintage',
  'isKeyDate',
] as const satisfies readonly (keyof CoinContentFields)[];

function keyOf(row: CoinNaturalKey): string {
  // JSON array encoding: no separator character can make two different keys collide.
  return JSON.stringify([row.country, row.denomination, row.year, row.mintMark, row.variety]);
}

function toCreateRow(row: DesiredCoinRow): DesiredCoinRow {
  return {
    country: row.country,
    denomination: row.denomination,
    year: row.year,
    mintMark: row.mintMark,
    variety: row.variety,
    name: row.name,
    imageUrl: row.imageUrl,
    imageSource: row.imageSource,
    imageLicense: row.imageLicense,
    diameterMm: row.diameterMm,
    weightG: row.weightG,
    thicknessMm: row.thicknessMm,
    material: row.material,
    mintage: row.mintage,
    isKeyDate: row.isKeyDate,
  };
}

export function planCoinImport(
  desired: readonly DesiredCoinRow[],
  existing: readonly ExistingCoinRow[],
): CoinImportPlan {
  // Collapse duplicate keys: Map keeps the first insertion position, set() overwrites the
  // value, so the last occurrence's values win at the first occurrence's position.
  const desiredByKey = new Map<string, DesiredCoinRow>();
  for (const row of desired) desiredByKey.set(keyOf(row), row);

  const existingByKey = new Map<string, ExistingCoinRow>();
  for (const row of existing) {
    const key = keyOf(row);
    if (!existingByKey.has(key)) existingByKey.set(key, row);
  }

  const plan: CoinImportPlan = { toCreate: [], toUpdate: [], unchanged: [], conflicts: [] };

  for (const [key, want] of desiredByKey) {
    const have = existingByKey.get(key);
    if (!have) {
      plan.toCreate.push(toCreateRow(want));
      continue;
    }

    // Never write over a coin that is not approved (strict, so a missing or unexpected
    // status is left alone too), and never create beside it: report it instead.
    if (have.status !== APPROVED_STATUS) {
      plan.conflicts.push({
        key: {
          country: have.country,
          denomination: have.denomination,
          year: have.year,
          mintMark: have.mintMark,
          variety: have.variety,
        },
        id: have.id,
        status: have.status,
      });
      continue;
    }

    const data: Record<string, unknown> = {};
    for (const field of CONTENT_FIELDS) {
      // null and undefined are the same "no value"; never write undefined, since Prisma
      // reads it as "leave unchanged" and a value-to-null change would be skipped.
      const next = want[field] ?? null;
      const current = have[field] ?? null;
      if (next !== current) data[field] = next;
    }

    if (Object.keys(data).length === 0) {
      plan.unchanged.push(have);
    } else {
      plan.toUpdate.push({
        id: have.id,
        key: {
          country: have.country,
          denomination: have.denomination,
          year: have.year,
          mintMark: have.mintMark,
          variety: have.variety,
        },
        data: data as Partial<CoinContentFields>,
      });
    }
  }

  return plan;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
