/**
 * Tests for: csv-parser (decodeCsvBuffer, parseCsv, CsvImportError)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Module: csv-parser.ts)
 *                   and § CSV parsing rules (binding)
 * Covers criteria: #11, #12, #9 (row limit) (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Pure module: no mocks needed, no filesystem, no network.
 */

import { CsvImportError, decodeCsvBuffer, parseCsv } from './csv-parser';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof CsvImportError ? err.code : `not-a-CsvImportError:${String(err)}`;
  }
  return undefined;
}

describe('CsvImportError', () => {
  it('carries the code as code and message and has the documented name', () => {
    const err = new CsvImportError('IMPORT_EMPTY');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('IMPORT_EMPTY');
    expect(err.message).toBe('IMPORT_EMPTY');
    expect(err.name).toBe('CsvImportError');

    const other = new CsvImportError('IMPORT_NOT_CSV');
    expect(other.code).toBe('IMPORT_NOT_CSV');
    expect(other.message).toBe('IMPORT_NOT_CSV');
  });
});

describe('decodeCsvBuffer', () => {
  it('decodes plain UTF-8 including non-ASCII characters', () => {
    const text = 'year,country\n1909,Україна\n';
    expect(decodeCsvBuffer(new TextEncoder().encode(text))).toBe(text);
    expect(decodeCsvBuffer(new TextEncoder().encode('é,ü'))).toBe('é,ü');
  });

  it('strips exactly one leading BOM', () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b')]);
    expect(decodeCsvBuffer(withBom)).toBe('a,b');
  });

  it('rejects an empty buffer with IMPORT_EMPTY', () => {
    expect(codeOf(() => decodeCsvBuffer(new Uint8Array(0)))).toBe('IMPORT_EMPTY');
  });

  it('rejects a buffer containing a 0x00 byte with IMPORT_NOT_CSV', () => {
    expect(codeOf(() => decodeCsvBuffer(new Uint8Array([0x61, 0x2c, 0x00, 0x62])))).toBe('IMPORT_NOT_CSV');
    expect(codeOf(() => decodeCsvBuffer(new Uint8Array([0x00])))).toBe('IMPORT_NOT_CSV');
  });

  it('rejects invalid UTF-8 with IMPORT_NOT_UTF8', () => {
    // 0xE9 followed by an ASCII byte is Latin-1 "é", not valid UTF-8
    expect(codeOf(() => decodeCsvBuffer(new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x2c, 0x61])))).toBe(
      'IMPORT_NOT_UTF8',
    );
    expect(codeOf(() => decodeCsvBuffer(new Uint8Array([0xff, 0xfe, 0x41])))).toBe('IMPORT_NOT_UTF8');
  });
});

describe('parseCsv: delimiters (criterion #12)', () => {
  it('parses comma-delimited input', () => {
    const parsed = parseCsv('year,country\n1909,USA\n1910,USA\n');
    expect(parsed.delimiter).toBe(',');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([
      { line: 2, values: ['1909', 'USA'] },
      { line: 3, values: ['1910', 'USA'] },
    ]);
  });

  it('auto-detects semicolon', () => {
    const parsed = parseCsv('year;country\n1909;USA\n');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([{ line: 2, values: ['1909', 'USA'] }]);
  });

  it('auto-detects tab', () => {
    const parsed = parseCsv('year\tcountry\n1909\tUSA\n');
    expect(parsed.delimiter).toBe('\t');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([{ line: 2, values: ['1909', 'USA'] }]);
  });

  it('picks the delimiter with the highest count on the first record line', () => {
    expect(parseCsv('a;b;c,d\n1;2;3,4').delimiter).toBe(';');
    expect(parseCsv('a,b,c;d\n1,2,3;4').delimiter).toBe(',');
  });

  it('resolves ties as comma > semicolon > tab', () => {
    expect(parseCsv('a,b;c\n1,2;3').delimiter).toBe(',');
    expect(parseCsv('a;b\tc\n1;2\t3').delimiter).toBe(';');
    expect(parseCsv('a,b\tc\n1,2\t3').delimiter).toBe(',');
  });

  it('does not count delimiters inside quotes when detecting', () => {
    const parsed = parseCsv('"a,b,c,d";e\n1;2');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['a,b,c,d', 'e']);
  });

  it('falls back to comma for a single-column file', () => {
    const parsed = parseCsv('coin\n1909-S VDB\n1910\n');
    expect(parsed.delimiter).toBe(',');
    expect(parsed.headers).toEqual(['coin']);
    expect(parsed.rows.map((r) => r.values)).toEqual([['1909-S VDB'], ['1910']]);
  });

  it('detects the delimiter from the first non-blank record, not from a leading blank line', () => {
    const parsed = parseCsv('\n\nyear;country\n1909;USA');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([{ line: 4, values: ['1909', 'USA'] }]);
  });
});

describe('parseCsv: BOM and line endings (criterion #12)', () => {
  it('strips a leading BOM from the first header', () => {
    const parsed = parseCsv('﻿year,country\n1909,USA');
    expect(parsed.headers).toEqual(['year', 'country']);
  });

  it('handles CRLF line endings', () => {
    const parsed = parseCsv('year;country\r\n1909;USA\r\n1910;USA\r\n');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([
      { line: 2, values: ['1909', 'USA'] },
      { line: 3, values: ['1910', 'USA'] },
    ]);
  });

  it('handles a BOM together with CRLF (Excel "CSV UTF-8")', () => {
    const parsed = parseCsv('﻿year;country\r\n1909;USA\r\n');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows).toEqual([{ line: 2, values: ['1909', 'USA'] }]);
  });

  it('treats a lone CR as a line break', () => {
    const parsed = parseCsv('a,b\r1,2\r3,4');
    expect(parsed.rows).toEqual([
      { line: 2, values: ['1', '2'] },
      { line: 3, values: ['3', '4'] },
    ]);
  });

  it('gives the same result with and without a trailing newline', () => {
    const withNewline = parseCsv('a,b\n1,2\n');
    const without = parseCsv('a,b\n1,2');
    expect(withNewline.rows).toEqual(without.rows);
    expect(withNewline.rows).toHaveLength(1);
  });
});

describe('parseCsv: quoting (criterion #12)', () => {
  it('keeps delimiters inside quotes literal', () => {
    const parsed = parseCsv('name,notes\nA,"one, two, three"\nB,"x;y"');
    expect(parsed.rows.map((r) => r.values)).toEqual([
      ['A', 'one, two, three'],
      ['B', 'x;y'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    const parsed = parseCsv('a,b\n"say ""hi""",2');
    expect(parsed.rows[0].values).toEqual(['say "hi"', '2']);
  });

  it('keeps newlines inside quotes literal and advances the line counter', () => {
    const parsed = parseCsv('a,b\n"x\ny",2\n3,4');
    expect(parsed.rows).toEqual([
      { line: 2, values: ['x\ny', '2'] },
      { line: 4, values: ['3', '4'] },
    ]);
  });

  it('keeps CRLF inside quotes literal', () => {
    const parsed = parseCsv('a,b\r\n"x\r\ny",2\r\n3,4\r\n');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].values[1]).toBe('2');
    expect(parsed.rows[0].values[0]).toMatch(/^x\r?\ny$/);
    expect(parsed.rows[1]).toEqual({ line: 4, values: ['3', '4'] });
  });

  it('does not throw on an unterminated quote and runs to end of input', () => {
    const parsed = parseCsv('a,b\n1,"never closed\n2,3');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].line).toBe(2);
    expect(parsed.rows[0].values[0]).toBe('1');
    expect(parsed.rows[0].values[1]).toContain('never closed');
  });
});

describe('parseCsv: blank lines, trimming, extra columns (criterion #12)', () => {
  it('skips blank lines and lines of only delimiters, but counts them in line numbers', () => {
    const parsed = parseCsv('a,b\n\n1,2\n,\n   ,  \n3,4\n\n');
    expect(parsed.rows).toEqual([
      { line: 3, values: ['1', '2'] },
      { line: 6, values: ['3', '4'] },
    ]);
  });

  it('trims every value, headers included', () => {
    const parsed = parseCsv('  year , country \n  1909 ,\t USA  ');
    expect(parsed.headers).toEqual(['year', 'country']);
    expect(parsed.rows[0].values).toEqual(['1909', 'USA']);
  });

  it('keeps extra columns and does not pad short rows', () => {
    const parsed = parseCsv('a,b\n1,2,3,4\n5');
    expect(parsed.rows[0].values).toEqual(['1', '2', '3', '4']);
    expect(parsed.rows[1].values).toEqual(['5']);
  });

  it('keeps empty cells in the middle of a row', () => {
    const parsed = parseCsv('a,b,c\n1,,3');
    expect(parsed.rows[0].values).toEqual(['1', '', '3']);
  });

  it('reports line 1 for the header of a normal file and line 2 for the first data row', () => {
    const parsed = parseCsv('h1,h2\nx,y');
    expect(parsed.rows[0].line).toBe(2);
  });
});

describe('parseCsv: errors (criteria #9, #11)', () => {
  it('throws IMPORT_EMPTY for empty text', () => {
    expect(codeOf(() => parseCsv(''))).toBe('IMPORT_EMPTY');
  });

  it('throws IMPORT_EMPTY for whitespace/newline-only text and delimiter-only lines', () => {
    expect(codeOf(() => parseCsv('\n\n  \n'))).toBe('IMPORT_EMPTY');
    expect(codeOf(() => parseCsv(',,,\n,,,\n'))).toBe('IMPORT_EMPTY');
    expect(codeOf(() => parseCsv('﻿\n'))).toBe('IMPORT_EMPTY');
  });

  it('throws IMPORT_NO_DATA_ROWS for a header with no rows', () => {
    expect(codeOf(() => parseCsv('year,country'))).toBe('IMPORT_NO_DATA_ROWS');
    expect(codeOf(() => parseCsv('year,country\n\n,\n'))).toBe('IMPORT_NO_DATA_ROWS');
  });

  it('throws IMPORT_TOO_MANY_ROWS when data rows exceed maxRows', () => {
    const text = 'a\n1\n2\n3\n';
    expect(codeOf(() => parseCsv(text, { maxRows: 2 }))).toBe('IMPORT_TOO_MANY_ROWS');
  });

  it('accepts exactly maxRows data rows and does not count blank lines', () => {
    const text = 'a\n1\n\n2\n\n';
    expect(parseCsv(text, { maxRows: 2 }).rows).toHaveLength(2);
    expect(codeOf(() => parseCsv(text, { maxRows: 1 }))).toBe('IMPORT_TOO_MANY_ROWS');
  });

  it('does not enforce a row limit when maxRows is not given', () => {
    const lines = ['a'];
    for (let i = 0; i < 2500; i++) lines.push(String(i));
    expect(parseCsv(lines.join('\n')).rows).toHaveLength(2500);
  });
});
