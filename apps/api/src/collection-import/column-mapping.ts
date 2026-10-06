import { IMPORT_FIELDS, type ImportColumnMapping, type ImportField } from '@coin-collector/shared';
import { CsvImportError } from './csv-parser';

// Pure header -> field mapping for the collection import.

export const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  year: ['year', 'yr', 'date', 'year minted'],
  country: ['country', 'nation', 'issuer', 'issuing country'],
  denomination: ['denomination', 'denom', 'face value', 'value', 'nominal'],
  mintMark: ['mint mark', 'mintmark', 'mint', 'mm'],
  variety: ['variety', 'variant', 'var'],
  combined: ['coin', 'description', 'title', 'name', 'item'],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = IMPORT_FIELDS.find(
      (candidate) =>
        mapping[candidate] === undefined && HEADER_SYNONYMS[candidate].includes(normalized),
    );
    if (field !== undefined) {
      mapping[field] = index;
    }
  });
  return mapping;
}

function isImportField(key: string): key is ImportField {
  return (IMPORT_FIELDS as readonly string[]).includes(key);
}

export function parseMappingField(
  raw: string | undefined,
  columnCount: number,
): ImportColumnMapping | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CsvImportError('IMPORT_INVALID_MAPPING');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CsvImportError('IMPORT_INVALID_MAPPING');
  }

  const mapping: ImportColumnMapping = {};
  const used = new Set<number>();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isImportField(key)) {
      throw new CsvImportError('IMPORT_INVALID_MAPPING');
    }
    if (value === null) {
      continue;
    }
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= columnCount
    ) {
      throw new CsvImportError('IMPORT_INVALID_MAPPING');
    }
    if (used.has(value)) {
      throw new CsvImportError('IMPORT_INVALID_MAPPING');
    }
    used.add(value);
    mapping[key] = value;
  }
  return mapping;
}
