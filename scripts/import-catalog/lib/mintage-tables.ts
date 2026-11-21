import { cleanWikitext, parseWikitextTables } from './wikitext';

// Turns the Year | Mint | Mintage | Comments tables of a Wikipedia mintage article into
// business-strike coin rows. No I/O. A mintage is only ever a figure the source gives:
// it is never estimated, filled in or set to 0.

export interface YearRange {
  from: number;
  to: number;
}

export type MintageKind = 'figure' | 'empty' | 'unknown' | 'footnote-only' | 'unparsed';

export interface ParsedMintage {
  mintage: number | null;
  kind: MintageKind;
  text: string;
}

const BRACKET_MARKER = /\[\s*(?:[a-z]{1,2}|\d{1,3}|note\s*\d+|nb\s*\d+)\s*\]/gi;
const FOOTNOTE_MARKUP = /<ref|\{\{\s*(?:efn|refn|sfn)/i;

export function parseMintage(rawCell: string): ParsedMintage {
  const cleaned = cleanWikitext(rawCell);
  const text = cleaned.replace(BRACKET_MARKER, '').replace(/\s+/g, ' ').trim();
  const hasFootnote = FOOTNOTE_MARKUP.test(rawCell) || cleaned.replace(BRACKET_MARKER, '') !== cleaned;

  if (text === '') return { mintage: null, kind: hasFootnote ? 'footnote-only' : 'empty', text };
  if (/^unknown$/i.test(text)) return { mintage: null, kind: 'unknown', text };
  if (/^\d{1,3}(,\d{3})+$/.test(text) || /^\d+$/.test(text)) {
    return { mintage: Number(text.replace(/,/g, '')), kind: 'figure', text };
  }
  // `^` (included above), approximations (c9, ≈20-50, >200) and anything else.
  return { mintage: null, kind: 'unparsed', text };
}

// `(P)` means struck there with no mark on the coin; a bare letter is the mark itself.
export function parseMintMark(rawCell: string): { ok: true; mintMark: string | null } | { ok: false } {
  const text = cleanWikitext(rawCell);
  if (/^\(\s*([A-Z]{1,2})\s*\)$/.test(text)) return { ok: true, mintMark: null };
  const bare = /^([A-Z]{1,2})$/.exec(text);
  if (bare) return { ok: true, mintMark: bare[1] };
  return { ok: false };
}

// The design a table caption names: "Puerto Rico reverse, 2009 (…)" → "Puerto Rico".
export function captionDesign(rawCaption: string): string {
  let s = cleanWikitext(rawCaption);
  let previous: string;
  do {
    previous = s;
    s = s.replace(/\([^()]*\)/g, '');
  } while (s !== previous);
  s = s.replace(/\b\d{4}(\s*[–-]\s*\d{4})?(;\s*\d{4})*/g, '');
  s = s.replace(/\s+/g, ' ').replace(/[\s,;–-]+$/, '');
  s = s.replace(/\s*(on\s+)?reverse$/i, '');
  return s.replace(/[\s,;–-]+$/, '').trim();
}

export type RowSkipReason = 'proof' | 'pattern' | 'restrike' | 'bullion';

export function rowSkipReason(note: string): RowSkipReason | null {
  const text = cleanWikitext(note);
  if (/\bproofs?\b/i.test(text)) return 'proof';
  if (/\bpatterns?\b/i.test(text)) return 'pattern';
  if (/\brestrikes?\b/i.test(text)) return 'restrike';
  if (/\bbullion\b/i.test(text)) return 'bullion';
  return null;
}

export type SkipReason = RowSkipReason | 'outside-years' | 'unrecognized-year' | 'unrecognized-mint' | 'included-above';

export interface MintageRow {
  year: number;
  mintMark: string | null;
  variety: string | null;
  mintage: number | null;
  mintageText: string;
  mintageKind: MintageKind;
  note: string;
  tableCaption: string;
  varietySource: 'none' | 'caption' | 'note';
}

export interface SkippedRow {
  year: number | null;
  mint: string;
  note: string;
  tableCaption: string;
  reason: SkipReason;
}

export interface TableGroup {
  caption: string;
  fromYear: number;
  toYear: number;
  rows: number;
}

export interface MintageParseResult {
  rows: MintageRow[];
  skipped: SkippedRow[];
  groups: TableGroup[];
  nullMintage: MintageRow[];
  duplicateKeys: MintageRow[][];
  tablesIgnored: string[];
}

interface Candidate {
  order: number;
  tableIndex: number;
  tableCaption: string;
  design: string;
  year: number;
  mintMark: string | null;
  mint: string;
  mintage: ParsedMintage;
  note: string;
  captionVariety: string;
}

const PROOF = /\bproofs?\b/i;

function findColumn(headers: string[], test: (h: string) => boolean): number {
  return headers.findIndex(test);
}

function keyOf(year: number, mintMark: string | null, variety: string): string {
  return JSON.stringify([year, mintMark, variety]);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function extractMintageRows(wikitext: string, years: YearRange): MintageParseResult {
  const skipped: Array<SkippedRow & { order: number }> = [];
  const tablesIgnored: string[] = [];
  let candidates: Candidate[] = [];
  const tableCaptions: string[] = [];
  let order = 0;

  parseWikitextTables(wikitext).forEach((table, tableIndex) => {
    const caption = cleanWikitext(table.caption);
    tableCaptions[tableIndex] = caption;
    const headers = table.headers.map((h) => cleanWikitext(h).toLowerCase());
    const yearCol = findColumn(headers, (h) => h.startsWith('year'));
    const mintCol = findColumn(headers, (h) => h === 'mint' || h === 'mint mark');
    const mintageCol = findColumn(headers, (h) => h.startsWith('mintage'));
    const noteCol = findColumn(
      headers,
      (h) => h.startsWith('comment') || h.startsWith('note') || h.startsWith('remark'),
    );
    if (yearCol < 0 || mintCol < 0 || mintageCol < 0) {
      tablesIgnored.push(caption || '(no caption)');
      return;
    }
    const proofOnly = PROOF.test(caption) || PROOF.test(headers[mintageCol]);
    const design = captionDesign(table.caption);

    for (const row of table.rows) {
      order += 1;
      const yearText = cleanWikitext(row[yearCol] ?? '');
      const mint = cleanWikitext(row[mintCol] ?? '');
      const note = noteCol >= 0 ? cleanWikitext(row[noteCol] ?? '') : '';
      const skip = (year: number | null, reason: SkipReason) =>
        skipped.push({ order, year, mint, note, tableCaption: caption, reason });

      if (!/^\d{4}$/.test(yearText)) {
        skip(null, 'unrecognized-year');
        continue;
      }
      const year = Number(yearText);
      if (year < years.from || year > years.to) {
        skip(year, 'outside-years');
        continue;
      }
      if (proofOnly) {
        skip(year, 'proof');
        continue;
      }
      const reason = rowSkipReason(note);
      if (reason) {
        skip(year, reason);
        continue;
      }
      const mark = parseMintMark(row[mintCol] ?? '');
      if (!mark.ok) {
        skip(year, 'unrecognized-mint');
        continue;
      }
      candidates.push({
        order,
        tableIndex,
        tableCaption: caption,
        design,
        year,
        mintMark: mark.mintMark,
        mint,
        mintage: parseMintage(row[mintageCol] ?? ''),
        note,
        captionVariety: '',
      });
    }
  });

  // Caption variety: only in years whose rows come from tables naming different designs.
  for (const sameYear of groupBy(candidates, (c) => String(c.year)).values()) {
    const designs = new Set(sameYear.map((c) => c.design));
    if (designs.size > 1) for (const c of sameYear) c.captionVariety = c.design;
  }

  // Included above: a no-note `^` row that shares its key with another row is a no-mark
  // strike already counted in that row's figure. A group made only of such rows is kept.
  const dropped = new Set<Candidate>();
  for (const group of groupBy(candidates, (c) => keyOf(c.year, c.mintMark, c.captionVariety)).values()) {
    if (group.length < 2) continue;
    const above = group.filter((c) => c.mintage.text === '^' && c.note === '');
    if (above.length === group.length) continue;
    for (const c of above) dropped.add(c);
  }
  for (const c of dropped) {
    skipped.push({
      order: c.order,
      year: c.year,
      mint: c.mint,
      note: c.note,
      tableCaption: c.tableCaption,
      reason: 'included-above',
    });
  }
  candidates = candidates.filter((c) => !dropped.has(c));

  // Note variety: only where the note is needed to tell rows with the same key apart.
  const noteSplit = new Set<Candidate>();
  for (const group of groupBy(candidates, (c) => keyOf(c.year, c.mintMark, c.captionVariety)).values()) {
    if (group.length < 2) continue;
    for (const c of group) if (c.note !== '') noteSplit.add(c);
  }

  const rows: MintageRow[] = candidates.map((c) => {
    let variety = c.captionVariety;
    let varietySource: MintageRow['varietySource'] = c.captionVariety ? 'caption' : 'none';
    if (noteSplit.has(c)) {
      variety = c.captionVariety ? `${c.captionVariety} (${c.note})` : c.note;
      varietySource = 'note';
    }
    return {
      year: c.year,
      mintMark: c.mintMark,
      variety: variety === '' ? null : variety,
      mintage: c.mintage.mintage,
      mintageText: c.mintage.text,
      mintageKind: c.mintage.kind,
      note: c.note,
      tableCaption: c.tableCaption,
      varietySource,
    };
  });

  const duplicateKeys = [...groupBy(rows, (r) => JSON.stringify([r.year, r.mintMark, r.variety])).values()].filter(
    (g) => g.length > 1,
  );

  const groups: TableGroup[] = [];
  const byTable = groupBy(
    candidates.map((c, i) => ({ c, row: rows[i] })),
    (x) => String(x.c.tableIndex),
  );
  for (const members of byTable.values()) {
    const yearsInTable = members.map((m) => m.row.year);
    groups.push({
      caption: tableCaptions[members[0].c.tableIndex],
      fromYear: Math.min(...yearsInTable),
      toYear: Math.max(...yearsInTable),
      rows: members.length,
    });
  }

  skipped.sort((a, b) => a.order - b.order);

  return {
    rows,
    skipped: skipped.map((s) => ({
      year: s.year,
      mint: s.mint,
      note: s.note,
      tableCaption: s.tableCaption,
      reason: s.reason,
    })),
    groups,
    nullMintage: rows.filter((r) => r.mintage === null),
    duplicateKeys,
    tablesIgnored,
  };
}
