import * as fs from 'node:fs';
import * as path from 'node:path';

import { cleanWikitext, parseWikitextTables } from '../../../scripts/import-catalog/lib/wikitext';

// CONTRACT_GAPs: none
// Strings labelled "synthetic" are made up to cover cases the real excerpts lack.

function readExcerpt(name: string): string {
  return fs.readFileSync(path.join(__dirname, '__fixtures__/wikipedia', name), 'utf8');
}

describe('cleanWikitext', () => {
  it('removes HTML comments', () => {
    expect(cleanWikitext('a<!-- hidden -->b')).toBe('ab');
  });

  it('removes ref tags with bodies and self-closing refs', () => {
    expect(cleanWikitext('2,360,000<ref>{{Cite web|url=https://x.example}}</ref>')).toBe('2,360,000');
    expect(cleanWikitext('5<ref name=":0" />6')).toBe('56');
  });

  it('removes templates, including nested ones', () => {
    expect(cleanWikitext('A {{tooltip|2=x|y}} B')).toBe('A B');
    expect(cleanWikitext('A {{outer|{{inner|z}}}} B')).toBe('A B');
  });

  it('removes File links and unwraps piped and plain wikilinks', () => {
    expect(cleanWikitext('[[File:Coin.jpg|thumb|x]]Cap')).toBe('Cap');
    expect(cleanWikitext('[[Chain cent|Chain reverse]]')).toBe('Chain reverse');
    expect(cleanWikitext('[[Wreath cent]]')).toBe('Wreath cent');
  });

  it('keeps the text of external links and drops bare ones', () => {
    expect(cleanWikitext('[http://example.org the site]')).toBe('the site');
    expect(cleanWikitext('x[http://example.org]y')).toBe('xy');
  });

  it('removes bold and italic quotes', () => {
    expect(cleanWikitext("'''Bold''' and ''it''")).toBe('Bold and it');
  });

  it('turns br into a space and strips other tags', () => {
    expect(cleanWikitext('a<br>b<br />c')).toBe('a b c');
    expect(cleanWikitext('<span class="x">Hi</span>')).toBe('Hi');
  });

  it('decodes the supported entities', () => {
    expect(cleanWikitext('a&nbsp;b &ndash; c &amp; d')).toBe('a b – c & d');
  });

  it('removes parentheses left empty and collapses whitespace', () => {
    expect(cleanWikitext('Name ({{tooltip|x}})')).toBe('Name');
    expect(cleanWikitext('  a \n  b   c ')).toBe('a b c');
  });

  it('returns different output for different input', () => {
    expect(cleanWikitext('[[A|one]]')).not.toBe(cleanWikitext('[[A|two]]'));
  });
});

describe('parseWikitextTables (synthetic)', () => {
  it('reads caption, headers and rows', () => {
    const wt = [
      '{| class="wikitable"',
      '|+My caption',
      '|-',
      '! Year !! Mint !! Mintage',
      '|-',
      '| 1900 || P || 1,000',
      '|-',
      '| 1901 || D || 2,000',
      '|}',
    ].join('\n');
    const tables = parseWikitextTables(wt);
    expect(tables).toHaveLength(1);
    expect(tables[0].caption).toBe('My caption');
    expect(tables[0].headers).toEqual(['Year', 'Mint', 'Mintage']);
    expect(tables[0].rows).toEqual([
      ['1900', 'P', '1,000'],
      ['1901', 'D', '2,000'],
    ]);
  });

  it('returns no tables for text without one', () => {
    expect(parseWikitextTables('just text\n== heading ==')).toEqual([]);
  });

  it('returns each table separately', () => {
    const wt = '{|\n|+One\n|-\n! A\n|-\n| 1\n|}\ntext\n{|\n|+Two\n|-\n! B\n|-\n| 2\n|}';
    const tables = parseWikitextTables(wt);
    expect(tables.map((t) => t.caption)).toEqual(['One', 'Two']);
    expect(tables[1].rows).toEqual([['2']]);
  });

  it('starts the first row implicitly when a header follows the caption with no row marker', () => {
    const wt = '{|\n|+Cap\n! Year\n! Mint\n|-\n| 1900\n| P\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.headers).toEqual(['Year', 'Mint']);
    expect(table.rows).toEqual([['1900', 'P']]);
  });

  it('strips cell attributes but keeps piped wikilinks', () => {
    const wt = '{|\n|-\n! width="10%" |Year\n|-\n| align="right" |36,103\n|-\n|[[Chain cent|Chain reverse]]\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.headers).toEqual(['Year']);
    expect(table.rows).toEqual([['36,103'], ['[[Chain cent|Chain reverse]]']]);
  });

  it('repeats a rowspan cell in the following rows', () => {
    const wt = [
      '{|',
      '|-',
      '! Year !! Mint',
      '|-',
      '| rowspan="3" |1900',
      '| P',
      '|-',
      '| D',
      '|-',
      '| S',
      '|-',
      '| 1901',
      '| P',
      '|}',
    ].join('\n');
    const [table] = parseWikitextTables(wt);
    expect(table.rows).toEqual([
      ['1900', 'P'],
      ['1900', 'D'],
      ['1900', 'S'],
      ['1901', 'P'],
    ]);
  });

  it('repeats a colspan cell across columns', () => {
    const wt = '{|\n|-\n! A !! B !! C\n|-\n| colspan="2" |both\n| solo\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.rows).toEqual([['both', 'both', 'solo']]);
  });

  it('expands colspan in header cells', () => {
    const wt = '{|\n|-\n! colspan="2" |Wide !! Narrow\n|-\n| 1 || 2 || 3\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.headers).toEqual(['Wide', 'Wide', 'Narrow']);
  });

  it('does not split on || inside templates or links', () => {
    const wt = '{|\n|-\n! A !! B\n|-\n| {{x|a||b}} || [[T|u]]\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.rows[0]).toEqual(['{{x|a||b}}', '[[T|u]]']);
  });

  it('appends continuation lines to the last cell', () => {
    const wt = '{|\n|-\n! A\n|-\n| line one\nline two\n|}';
    const [table] = parseWikitextTables(wt);
    expect(table.rows[0][0]).toBe('line one\nline two');
  });

  it('skips a nested table inside a table', () => {
    const wt = [
      '{|',
      '|-',
      '! A',
      '|-',
      '| outer',
      '|-',
      '| {|',
      '|-',
      '| inner',
      '|}',
      '|-',
      '| after',
      '|}',
    ].join('\n');
    const tables = parseWikitextTables(wt);
    expect(tables).toHaveLength(1);
    expect(JSON.stringify(tables[0].rows)).not.toContain('inner');
    expect(JSON.stringify(tables[0].rows)).toContain('outer');
    expect(JSON.stringify(tables[0].rows)).toContain('after');
  });

  it('uses an empty caption and no headers when there are none', () => {
    const [table] = parseWikitextTables('{|\n|-\n| a || b\n|}');
    expect(table.caption).toBe('');
    expect(table.headers).toEqual([]);
    expect(table.rows).toEqual([['a', 'b']]);
  });

  it('trims leading whitespace on lines', () => {
    const [table] = parseWikitextTables('  {|\n  |+Cap\n  |-\n  ! A\n  |-\n  | x\n  |}');
    expect(table.caption).toBe('Cap');
    expect(table.rows).toEqual([['x']]);
  });
});

describe('parseWikitextTables (real excerpts)', () => {
  it('reads the 5 tables of the cent excerpt with 4 columns each', () => {
    const tables = parseWikitextTables(readExcerpt('united-states-cent-mintage-figures.wikitext'));
    expect(tables).toHaveLength(5);
    for (const table of tables) {
      expect(table.headers.map((h) => cleanWikitext(h))).toEqual(['Year', 'Mint', 'Mintage', 'Comments']);
      for (const row of table.rows) expect(row).toHaveLength(4);
    }
    expect(tables.map((t) => t.rows.length)).toEqual([2, 6, 2, 10, 6]);
  });

  it('repeats rowspan years in the Liberty Cap table', () => {
    const tables = parseWikitextTables(readExcerpt('united-states-cent-mintage-figures.wikitext'));
    const years = tables[1].rows.map((r) => r[0]);
    expect(years).toEqual(['1793', '1794', '1795', '1795', '1795', '1796']);
  });

  it('keeps raw wikitext in cells and the caption', () => {
    const tables = parseWikitextTables(readExcerpt('united-states-cent-mintage-figures.wikitext'));
    expect(tables[0].caption).toBe('Flowing Hair large cent, 1793 (Copper)');
    expect(tables[0].rows[0][3]).toBe('[[Chain cent|Chain reverse]]');
    expect(tables[1].rows[4][3]).toContain('<ref>');
  });

  it('reads the quarter excerpt tables, including headers that directly follow the caption', () => {
    const tables = parseWikitextTables(readExcerpt('washington-quarter-mintage-figures.wikitext'));
    expect(tables.map((t) => cleanWikitext(t.caption))).toEqual([
      'Eagle reverse, 1932–1964 (Silver)',
      'Eagle reverse, 1965–1974 (Nickel-clad copper)',
      'Bicentennial reverse, 1976 (Nickel-clad copper unless otherwise noted)',
      'Eagle reverse, 1977–1998 (Nickel-clad copper unless otherwise noted)',
      'District of Columbia reverse, 2009 (Nickel-clad copper unless otherwise noted)',
      'Puerto Rico reverse, 2009 (Nickel-clad copper unless otherwise noted)',
    ]);
    expect(tables.map((t) => t.rows.length)).toEqual([12, 4, 7, 4, 4, 4]);
    expect(tables[0].headers.map((h) => cleanWikitext(h))).toEqual(['Year', 'Mint', 'Mintage', 'Comments']);
    expect(tables[0].rows[0]).toEqual(['1932', '(P)', '5,404,000', '']);
  });

  it('keeps the footnoted 1965 figure raw', () => {
    const tables = parseWikitextTables(readExcerpt('washington-quarter-mintage-figures.wikitext'));
    const sms = tables[1].rows[3];
    expect(sms[0]).toBe('1965');
    expect(sms[2]).toContain('2,360,000');
    expect(sms[2]).toContain('<ref>');
    expect(sms[3]).toBe('Satin finish, Special Mint Set');
  });
});
