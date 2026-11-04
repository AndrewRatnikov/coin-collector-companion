import type {
  CoinGrade,
  ImportColumnMapping,
  ImportPreviewWarning,
} from '@coin-collector/shared';

// Pure grade normalisation for the collection import. No I/O. Cell values are matched after
// trimming and lower-casing only: no inner-whitespace collapsing, accent stripping or partial
// matching, so anything else (e.g. "MS-65", "Proof", "AG") is unrecognised.

// Lower-case cell value -> neutral grade. English codes, common aliases and Spanish abbreviations.
export const GRADE_ALIASES: Readonly<Record<string, CoinGrade>> = {
  g: 'G',
  vg: 'VG',
  f: 'F',
  vf: 'VF',
  xf: 'XF',
  au: 'AU',
  unc: 'UNC',
  ef: 'XF',
  bu: 'UNC',
  ms: 'UNC',
  aunc: 'AU',
  rc: 'G',
  'bc-': 'VG',
  bc: 'F',
  mbc: 'VF',
  ebc: 'XF',
  'ebc+': 'AU',
  sc: 'UNC',
};

export type ImportGradeResult =
  | { kind: 'grade'; grade: CoinGrade }
  | { kind: 'empty' }
  | { kind: 'unrecognised'; value: string };

export function parseImportGrade(raw: string): ImportGradeResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { kind: 'empty' };
  }
  const key = trimmed.toLowerCase();
  const grade = Object.prototype.hasOwnProperty.call(GRADE_ALIASES, key)
    ? GRADE_ALIASES[key]
    : undefined;
  if (grade !== undefined) {
    return { kind: 'grade', grade };
  }
  return { kind: 'unrecognised', value: trimmed };
}

function parseMappedCell(
  values: readonly string[],
  mapping: ImportColumnMapping,
): ImportGradeResult | null {
  if (mapping.grade === undefined) {
    return null;
  }
  return parseImportGrade(values[mapping.grade] ?? '');
}

// The row's normalised grade; null when the Grade column is unmapped, empty or unrecognised.
export function rowGrade(values: readonly string[], mapping: ImportColumnMapping): CoinGrade | null {
  const result = parseMappedCell(values, mapping);
  return result?.kind === 'grade' ? result.grade : null;
}

// One warning per row whose mapped Grade cell is non-empty and unrecognised, in input order.
export function collectGradeWarnings(
  rows: readonly { line: number; values: readonly string[] }[],
  mapping: ImportColumnMapping,
): ImportPreviewWarning[] {
  if (mapping.grade === undefined) {
    return [];
  }
  const warnings: ImportPreviewWarning[] = [];
  for (const row of rows) {
    const result = parseMappedCell(row.values, mapping);
    if (result?.kind === 'unrecognised') {
      warnings.push({ line: row.line, code: 'grade_not_recognised', value: result.value });
    }
  }
  return warnings;
}
