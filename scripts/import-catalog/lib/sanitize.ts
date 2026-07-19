// Any of these (case-insensitive, whitespace-trimmed) means "no value" — they all
// must collapse to the same '' before reaching Prisma, or the Coin natural-key
// unique constraint silently stops deduping (system-design_v2.md §4.1/§4.3).
const NONE_PLACEHOLDERS = new Set(['', 'none', 'n/a', 'na']);

export function sanitizeIdentityField(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = value.trim();
  return NONE_PLACEHOLDERS.has(trimmed.toLowerCase()) ? '' : trimmed;
}
