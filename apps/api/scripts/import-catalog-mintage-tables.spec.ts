import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  captionDesign,
  extractMintageRows,
  parseMintMark,
  parseMintage,
  rowSkipReason,
} from '../../../scripts/import-catalog/lib/mintage-tables';

// CONTRACT_GAPs: none
// Cells and tables marked "synthetic" are made up to cover cases the two real
// articles lack (a Proof column, a footnote-only cell, "unknown", [a] markers).

function readExcerpt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '__fixtures__/wikipedia', name), 'utf8');
}

/** Synthetic table builder: header cells, then rows of cells. */
function table(caption: string, headers: string[], rows: string[][]): string {
  const lines = ['{| class="wikitable"'];
  if (caption) lines.push(`|+${caption}`);
  lines.push('|-', `! ${headers.join(' !! ')}`);
  for (const row of rows) lines.push('|-', `| ${row.join(' || ')}`);
  lines.push('|}');
  return lines.join('\n');
}

const STD = ['Year', 'Mint', 'Mintage', 'Comments'];

describe('parseMintage', () => {
  it('parses figures with thousands separators', () => {
    expect(parseMintage('36,103')).toMatchObject({ mintage: 36103, kind: 'figure' });
    expect(parseMintage('1,819,717,540')).toMatchObject({ mintage: 1819717540, kind: 'figure' });
  });

  it('parses a plain number', () => {
    expect(parseMintage('800')).toMatchObject({ mintage: 800, kind: 'figure' });
  });

  it('keeps the figure when a footnote carries one (real: 1965 satin finish)', () => {
    const cell =
      '2,360,000<ref>{{Cite web|url=https://www.pcgs.com/coinfacts/coin/1965-25c-sms/5997|title=1965 25C SMS|website=PCGS}}</ref>';
    expect(parseMintage(cell)).toEqual({ mintage: 2360000, kind: 'figure', text: '2,360,000' });
  });

  it('strips bracket footnote markers from a figure (synthetic)', () => {
    expect(parseMintage('1,000[a]')).toMatchObject({ mintage: 1000, kind: 'figure', text: '1,000' });
    expect(parseMintage('2,000 [12]')).toMatchObject({ mintage: 2000, kind: 'figure' });
  });

  it('gives null for an empty cell', () => {
    expect(parseMintage('')).toMatchObject({ mintage: null, kind: 'empty' });
    expect(parseMintage('   ')).toMatchObject({ mintage: null, kind: 'empty' });
  });

  it('gives null for "unknown" in any case', () => {
    expect(parseMintage('unknown')).toMatchObject({ mintage: null, kind: 'unknown' });
    expect(parseMintage('Unknown')).toMatchObject({ mintage: null, kind: 'unknown' });
  });

  it('gives null for a footnote-only cell (synthetic)', () => {
    expect(parseMintage('<ref name="a" />')).toMatchObject({ mintage: null, kind: 'footnote-only' });
    expect(parseMintage('<ref>{{cite web|url=https://x.example}}</ref>')).toMatchObject({
      mintage: null,
      kind: 'footnote-only',
    });
    expect(parseMintage('{{efn|Some note}}')).toMatchObject({ mintage: null, kind: 'footnote-only' });
    expect(parseMintage('[a]')).toMatchObject({ mintage: null, kind: 'footnote-only' });
  });

  it('gives null, kind unparsed, for "^", approximations and other non-figures (real)', () => {
    expect(parseMintage('^')).toEqual({ mintage: null, kind: 'unparsed', text: '^' });
    expect(parseMintage('c9')).toMatchObject({ mintage: null, kind: 'unparsed', text: 'c9' });
    expect(parseMintage('c3-4<ref>{{Cite web|url=http://uspatterns.com/p2085.html}}</ref>')).toMatchObject({
      mintage: null,
      kind: 'unparsed',
      text: 'c3-4',
    });
    expect(parseMintage('≈20-50').mintage).toBeNull();
    expect(parseMintage('>200').mintage).toBeNull();
    expect(parseMintage('?').mintage).toBeNull();
    expect(parseMintage('(150,000)').mintage).toBeNull();
  });

  it('never returns 0 for a missing figure', () => {
    for (const cell of ['', 'unknown', '^', 'c9', '<ref name="x" />']) {
      expect(parseMintage(cell).mintage).not.toBe(0);
      expect(parseMintage(cell).mintage).toBeNull();
    }
  });

  it('distinguishes different figures', () => {
    expect(parseMintage('1,000').mintage).not.toBe(parseMintage('2,000').mintage);
  });
});

describe('parseMintMark', () => {
  it('reads a bare letter as the mark', () => {
    expect(parseMintMark('D')).toEqual({ ok: true, mintMark: 'D' });
    expect(parseMintMark('S')).toEqual({ ok: true, mintMark: 'S' });
    expect(parseMintMark('P')).toEqual({ ok: true, mintMark: 'P' });
  });

  it('reads a parenthesised letter as no mark', () => {
    expect(parseMintMark('(P)')).toEqual({ ok: true, mintMark: null });
    expect(parseMintMark('( W )')).toEqual({ ok: true, mintMark: null });
  });

  it('accepts two-letter marks', () => {
    expect(parseMintMark('CC')).toEqual({ ok: true, mintMark: 'CC' });
  });

  it('cleans wikitext before deciding', () => {
    expect(parseMintMark("'''D'''")).toEqual({ ok: true, mintMark: 'D' });
  });

  it('rejects empty, unknown and compound cells', () => {
    expect(parseMintMark('')).toEqual({ ok: false });
    expect(parseMintMark('?')).toEqual({ ok: false });
    expect(parseMintMark('P (Satin)')).toEqual({ ok: false });
    expect(parseMintMark('(P/D/S)')).toEqual({ ok: false });
  });
});

describe('captionDesign', () => {
  it('takes the design before the year and removes "reverse" (real)', () => {
    expect(captionDesign('Puerto Rico reverse, 2009 (Nickel-clad copper unless otherwise noted)')).toBe('Puerto Rico');
    expect(captionDesign('District of Columbia reverse, 2009 (Nickel-clad copper unless otherwise noted)')).toBe(
      'District of Columbia',
    );
  });

  it('removes "on reverse" and templates (real)', () => {
    expect(
      captionDesign('Shield on reverse, 1860–1864 ({{tooltip|2=75% copper, 25% nickel|Cupronickel|link=yes}})'),
    ).toBe('Shield');
  });

  it('keeps a design name that is not a reverse (real)', () => {
    expect(captionDesign('Liberty Cap large cent, 1793–1796 (Copper)')).toBe('Liberty Cap large cent');
  });

  it('returns an empty string for an empty caption', () => {
    expect(captionDesign('')).toBe('');
  });

  it('gives different designs for different captions', () => {
    expect(captionDesign('Eagle reverse, 1932–1964 (Silver)')).not.toBe(captionDesign('Shield reverse, 1860 (Copper)'));
  });
});

describe('rowSkipReason', () => {
  it('detects proof notes (real)', () => {
    expect(rowSkipReason('Proof')).toBe('proof');
    expect(rowSkipReason('Silver proof')).toBe('proof');
    expect(rowSkipReason('Proof only')).toBe('proof');
    expect(rowSkipReason('Proof, struck in 1975')).toBe('proof');
  });

  it('detects pattern, restrike and bullion notes', () => {
    expect(rowSkipReason('Pattern, silver-clad copper')).toBe('pattern');
    expect(rowSkipReason('Restrike, 68 known')).toBe('restrike');
    expect(rowSkipReason('Silver bullion')).toBe('bullion');
  });

  it('checks proof before pattern', () => {
    expect(rowSkipReason('Proof pattern')).toBe('proof');
  });

  it('returns null for business-strike notes', () => {
    expect(rowSkipReason('')).toBeNull();
    expect(rowSkipReason('Lettered edge')).toBeNull();
    expect(rowSkipReason('Struck in 1975 and 1976')).toBeNull();
    expect(rowSkipReason('Doubled die errors are known.')).toBeNull();
  });

  it('matches whole words only', () => {
    expect(rowSkipReason('Proofread by hand')).toBeNull();
  });
});

describe('extractMintageRows (real cent excerpt)', () => {
  const cent = readExcerpt('united-states-cent-mintage-figures.wikitext');
  const result = extractMintageRows(cent, { from: 1793, to: 1865 });

  it('returns the 17 business-strike rows in source order', () => {
    expect(
      result.rows.map((r) => [r.year, r.mintMark, r.variety, r.mintage, r.varietySource]),
    ).toEqual([
      [1793, null, 'Flowing Hair large cent (Chain reverse)', 36103, 'note'],
      [1793, null, 'Flowing Hair large cent (Wreath reverse)', 63353, 'note'],
      [1793, null, 'Liberty Cap large cent', 11056, 'caption'],
      [1794, null, null, 918521, 'none'],
      [1795, null, 'Lettered edge', 37000, 'note'],
      [1795, null, 'Plain edge', 501500, 'note'],
      [1795, null, 'Reeded edge, 9 known', null, 'note'],
      [1796, null, null, 109825, 'none'],
      [1859, null, null, 36400000, 'none'],
      [1860, null, null, 20566000, 'none'],
      [1861, null, null, 10100000, 'none'],
      [1862, null, null, 28075000, 'none'],
      [1863, null, null, 49840000, 'none'],
      [1864, null, null, 13740000, 'none'],
      [1864, null, null, 39233714, 'none'],
      [1864, null, 'L on ribbon', null, 'note'],
      [1865, null, null, 35429286, 'none'],
    ]);
  });

  it('records the unparsed mintage cells without inventing a figure', () => {
    const c9 = result.rows.find((r) => r.variety === 'Reeded edge, 9 known');
    expect(c9).toMatchObject({ mintage: null, mintageText: 'c9', mintageKind: 'unparsed' });
    const ribbon = result.rows.find((r) => r.variety === 'L on ribbon');
    expect(ribbon).toMatchObject({ mintage: null, mintageText: '^', mintageKind: 'unparsed', note: 'L on ribbon' });
  });

  it('skips 9 proof rows and nothing else', () => {
    expect(result.skipped).toHaveLength(9);
    expect(new Set(result.skipped.map((s) => s.reason))).toEqual(new Set(['proof']));
    expect(result.skipped.map((s) => s.year)).toEqual([1859, 1860, 1861, 1862, 1863, 1864, 1864, 1864, 1865]);
  });

  it('keeps no proof mintage among the rows', () => {
    const figures = result.rows.map((r) => r.mintage);
    for (const proof of [800, 1000, 550, 460, 370, 150, 35, 500]) expect(figures).not.toContain(proof);
  });

  it('lists the two null mintages', () => {
    expect(result.nullMintage).toHaveLength(2);
    expect(result.nullMintage.map((r) => r.mintageText)).toEqual(['c9', '^']);
  });

  it('flags the two 1864 rows without a variety as duplicates', () => {
    expect(result.duplicateKeys).toHaveLength(1);
    expect(result.duplicateKeys[0].map((r) => r.mintage)).toEqual([13740000, 39233714]);
  });

  it('groups rows per table', () => {
    expect(result.groups.map((g) => [g.fromYear, g.toYear, g.rows])).toEqual([
      [1793, 1793, 2],
      [1793, 1796, 6],
      [1859, 1859, 1],
      [1860, 1864, 5],
      [1864, 1865, 3],
    ]);
    expect(result.groups[1].caption).toBe('Liberty Cap large cent, 1793–1796 (Copper)');
  });

  it('ignores no tables', () => {
    expect(result.tablesIgnored).toEqual([]);
  });

  it('applies the year filter (different range, different result)', () => {
    const narrow = extractMintageRows(cent, { from: 1859, to: 1860 });
    expect(narrow.rows.map((r) => r.year)).toEqual([1859, 1860]);
    expect(narrow.skipped.filter((s) => s.reason === 'outside-years').length).toBeGreaterThan(0);
    expect(narrow.rows.length).not.toBe(result.rows.length);
  });
});

describe('extractMintageRows (real quarter excerpt)', () => {
  const quarter = readExcerpt('washington-quarter-mintage-figures.wikitext');
  const result = extractMintageRows(quarter, { from: 1932, to: 2009 });

  it('returns the 23 business-strike rows in source order', () => {
    expect(result.rows).toHaveLength(23);
    expect(result.rows.map((r) => [r.year, r.mintMark, r.variety, r.mintage, r.varietySource])).toEqual([
      [1932, null, null, 5404000, 'none'],
      [1932, 'D', null, 436800, 'none'],
      [1932, 'S', null, 408000, 'none'],
      [1934, null, null, 31912052, 'none'],
      [1934, 'D', null, 3527200, 'none'],
      [1935, null, null, 32484000, 'none'],
      [1935, 'D', null, 5780000, 'none'],
      [1935, 'S', null, 5660000, 'none'],
      [1936, null, null, 41300000, 'none'],
      [1936, 'D', null, 5374000, 'none'],
      [1936, 'S', null, 3828000, 'none'],
      [1965, null, null, 1819717540, 'none'],
      [1965, null, 'Satin finish, Special Mint Set', 2360000, 'note'],
      [1976, null, null, 809784016, 'none'],
      [1976, 'D', null, 860118839, 'none'],
      [1976, 'S', null, 4908319, 'none'],
      [1977, null, null, 468556000, 'none'],
      [1977, null, 'First time West Point produced the quarter', null, 'note'],
      [1977, 'D', null, 256524978, 'none'],
      [2009, 'P', 'District of Columbia', 83600000, 'caption'],
      [2009, 'D', 'District of Columbia', 88800000, 'caption'],
      [2009, 'P', 'Puerto Rico', 53000000, 'caption'],
      [2009, 'D', 'Puerto Rico', 86000000, 'caption'],
    ]);
  });

  it('skips 9 proof rows, 1 pattern and 2 included-above rows', () => {
    const counts: Record<string, number> = {};
    for (const s of result.skipped) counts[s.reason] = (counts[s.reason] ?? 0) + 1;
    expect(counts).toEqual({ proof: 9, pattern: 1, 'included-above': 2 });
    const above = result.skipped.filter((s) => s.reason === 'included-above');
    expect(above.every((s) => s.year === 1965)).toBe(true);
  });

  it('skips the pattern row with its note', () => {
    const pattern = result.skipped.find((s) => s.reason === 'pattern');
    expect(pattern).toMatchObject({ year: 1976 });
    expect(pattern?.note).toMatch(/Pattern/);
  });

  it('does not turn plain notes into varieties when no other row shares the key', () => {
    const y1934 = result.rows.find((r) => r.year === 1934 && r.mintMark === null);
    expect(y1934?.variety).toBeNull();
    expect(y1934?.note).toBe('Doubled die errors are known.');
    const y1976 = result.rows.find((r) => r.year === 1976 && r.mintMark === null);
    expect(y1976?.variety).toBeNull();
  });

  it('keeps the footnoted 1965 figure', () => {
    const sms = result.rows.find((r) => r.variety === 'Satin finish, Special Mint Set');
    expect(sms).toMatchObject({ mintage: 2360000, mintageKind: 'figure', mintageText: '2,360,000' });
  });

  it('lists the one null mintage (the 1977 West Point ^ row)', () => {
    expect(result.nullMintage).toHaveLength(1);
    expect(result.nullMintage[0]).toMatchObject({ year: 1977, mintageText: '^' });
  });

  it('has no duplicate natural keys and ignores no table', () => {
    expect(result.duplicateKeys).toEqual([]);
    expect(result.tablesIgnored).toEqual([]);
  });

  it('groups rows per table', () => {
    expect(result.groups.map((g) => [g.fromYear, g.toYear, g.rows])).toEqual([
      [1932, 1936, 11],
      [1965, 1965, 2],
      [1976, 1976, 3],
      [1977, 1977, 3],
      [2009, 2009, 2],
      [2009, 2009, 2],
    ]);
  });

  it('applies the year filter 1965-1977', () => {
    const r = extractMintageRows(quarter, { from: 1965, to: 1977 });
    expect(r.rows).toHaveLength(8);
    const counts: Record<string, number> = {};
    for (const s of r.skipped) counts[s.reason] = (counts[s.reason] ?? 0) + 1;
    expect(counts).toEqual({ 'outside-years': 20, proof: 4, pattern: 1, 'included-above': 2 });
  });

  it('is deterministic', () => {
    expect(extractMintageRows(quarter, { from: 1932, to: 2009 })).toEqual(result);
  });
});

describe('extractMintageRows (synthetic tables)', () => {
  it('ignores a Proof column and reads only Year, Mint, Mintage and Comments', () => {
    const wt = table('Test, 1950–1951 (Silver)', ['Year', 'Mint', 'Mintage', 'Proof', 'Comments'], [
      ['1950', 'D', '1,000', '777', ''],
      ['1951', 'S', '2,000', '888', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1950, to: 1951 });
    expect(r.rows.map((x) => [x.year, x.mintMark, x.mintage])).toEqual([
      [1950, 'D', 1000],
      [1951, 'S', 2000],
    ]);
    expect(r.skipped).toEqual([]);
  });

  it('skips every row of a proof-only table (caption says proof)', () => {
    const wt = table('Proof coins, 1950 (Silver)', STD, [['1950', 'S', '51,386', '']]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toEqual([]);
    expect(r.skipped.map((s) => s.reason)).toEqual(['proof']);
  });

  it('skips every row of a proof-only table (Mintage header says proof)', () => {
    const wt = table('Test, 1950', ['Year', 'Mint', 'Mintage (proof)', 'Comments'], [['1950', 'S', '51,386', '']]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toEqual([]);
    expect(r.skipped.map((s) => s.reason)).toEqual(['proof']);
  });

  it('keeps a business row and skips a proof row in the same table', () => {
    const wt = table('Test, 1950', STD, [
      ['1950', 'D', '100', ''],
      ['1950', 'S', '50', 'Proof'],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].mintage).toBe(100);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]).toMatchObject({ reason: 'proof', year: 1950 });
  });

  it('skips restrike and bullion rows', () => {
    const wt = table('Test, 1950', STD, [
      ['1950', 'D', '100', ''],
      ['1951', 'D', '5', 'Restrike, 68 known'],
      ['1952', 'D', '6', 'Silver bullion'],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(['restrike', 'bullion']);
  });

  it('gives null mintage for an unknown cell and a footnote-only cell, never a number', () => {
    const wt = table('Test, 1950', STD, [
      ['1950', 'D', 'unknown', ''],
      ['1951', 'D', '<ref name="n" />', ''],
      ['1952', 'D', '{{efn|see note}}', ''],
      ['1953', 'D', '5,000', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows.map((x) => x.mintage)).toEqual([null, null, null, 5000]);
    expect(r.rows.map((x) => x.mintageKind)).toEqual(['unknown', 'footnote-only', 'footnote-only', 'figure']);
    expect(r.nullMintage).toHaveLength(3);
  });

  it('skips rows outside the year range, inclusive at both ends', () => {
    const wt = table('Test', STD, [
      ['1899', 'D', '1', ''],
      ['1900', 'D', '2', ''],
      ['2000', 'D', '3', ''],
      ['2001', 'D', '4', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows.map((x) => x.year)).toEqual([1900, 2000]);
    expect(r.skipped.map((s) => [s.year, s.reason])).toEqual([
      [1899, 'outside-years'],
      [2001, 'outside-years'],
    ]);
  });

  it('skips rows with an unrecognized year or mint mark', () => {
    const wt = table('Test', STD, [
      ['1900', 'D', '2', ''],
      ['Total', 'D', '9', ''],
      ['1901', '?', '9', ''],
      ['1902', 'P (Satin)', '9', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.map((s) => [s.year, s.reason])).toEqual([
      [null, 'unrecognized-year'],
      [1901, 'unrecognized-mint'],
      [1902, 'unrecognized-mint'],
    ]);
  });

  it('reports a table without Year, Mint and Mintage columns as ignored', () => {
    const wide = table('50 State quarters wide table', ['Year', 'State', 'Philadelphia', 'Denver'], [
      ['1999', 'Delaware', '1,000', '2,000'],
    ]);
    const nocaption = table('', ['Foo', 'Bar'], [['a', 'b']]);
    const r = extractMintageRows(`${wide}\n\n${nocaption}`, { from: 1900, to: 2100 });
    expect(r.rows).toEqual([]);
    expect(r.tablesIgnored).toEqual(['50 State quarters wide table', '(no caption)']);
  });

  it('finds columns by header, in any order, with Mint mark and Notes variants', () => {
    const wt = table('Test', ['Mintage', 'Notes', 'Mint mark', 'Year'], [['1,234', 'Plain', 'S', '1950']]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ year: 1950, mintMark: 'S', mintage: 1234 });
  });

  it('works with no Comments column (note is empty)', () => {
    const wt = table('Test', ['Year', 'Mint', 'Mintage'], [['1950', 'D', '10']]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows[0].note).toBe('');
  });

  it('emits duplicate keys without merging or dropping them', () => {
    const wt = table('Test', STD, [
      ['1950', 'D', '10', ''],
      ['1950', 'D', '20', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows.map((x) => x.mintage)).toEqual([10, 20]);
    expect(r.duplicateKeys).toHaveLength(1);
    expect(r.duplicateKeys[0].map((x) => x.mintage)).toEqual([10, 20]);
  });

  it('uses the caption design as variety only when tables of one year differ', () => {
    const a = table('Alpha reverse, 1950 (Copper)', STD, [['1950', 'D', '10', '']]);
    const b = table('Beta reverse, 1950 (Copper)', STD, [['1950', 'D', '20', '']]);
    const both = extractMintageRows(`${a}\n${b}`, { from: 1900, to: 2000 });
    expect(both.rows.map((x) => [x.variety, x.varietySource])).toEqual([
      ['Alpha', 'caption'],
      ['Beta', 'caption'],
    ]);
    expect(both.duplicateKeys).toEqual([]);
    const alone = extractMintageRows(a, { from: 1900, to: 2000 });
    expect(alone.rows[0]).toMatchObject({ variety: null, varietySource: 'none' });
  });

  it('keeps a row note as the caption-variety suffix when both exist', () => {
    const a = table('Alpha reverse, 1950', STD, [
      ['1950', 'D', '10', ''],
      ['1950', 'D', '11', 'Wide rim'],
    ]);
    const b = table('Beta reverse, 1950', STD, [['1950', 'D', '20', '']]);
    const r = extractMintageRows(`${a}\n${b}`, { from: 1900, to: 2000 });
    expect(r.rows.map((x) => x.variety)).toEqual(['Alpha', 'Alpha (Wide rim)', 'Beta']);
    expect(r.rows[1].varietySource).toBe('note');
  });

  it('drops a no-note "^" row that shares its key with another row, as included-above', () => {
    const wt = table('Test', STD, [
      ['1950', '(P)', '1,000', ''],
      ['1950', '(D)', '^', ''],
      ['1950', '(S)', '^', ''],
    ]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(['included-above', 'included-above']);
  });

  it('keeps a lone "^" row with no note', () => {
    const wt = table('Test', STD, [['1950', 'D', '^', '']]);
    const r = extractMintageRows(wt, { from: 1900, to: 2000 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].mintage).toBeNull();
  });

  it('returns empty results for text with no tables', () => {
    const r = extractMintageRows('nothing here', { from: 1900, to: 2000 });
    expect(r).toEqual({
      rows: [],
      skipped: [],
      groups: [],
      nullMintage: [],
      duplicateKeys: [],
      tablesIgnored: [],
    });
  });
});
