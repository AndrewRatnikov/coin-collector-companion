/**
 * Tests for: shared CSV primitives (@coin-collector/shared) and the refactored @/lib/missing-list
 * Contract source: runs/run_20261111_062918/plan.md § Interface Contract (Module: @coin-collector/shared (CSV primitives), Module: @/lib/missing-list)
 * Covers criteria: #3, #4, #8 (from prd.md)
 *
 * CONTRACT_GAPs: none
 *
 * The web suite reads @coin-collector/shared from dist/, so build shared first.
 */

import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvCell, csvDocument, csvRow, formatLocalDate } from '@coin-collector/shared';
import { MISSING_CSV_HEADER, buildMissingCsv, formatLocalDate as missingListFormatLocalDate } from '@/lib/missing-list';

const BOM = '﻿';

describe('CSV_BOM', () => {
  it('is the UTF-8 byte order mark character', () => {
    expect(CSV_BOM).toBe(BOM);
    expect(CSV_BOM).toHaveLength(1);
  });
});

describe('csvCell', () => {
  it('leaves a plain value unchanged', () => {
    expect(csvCell('Lincoln Cent')).toBe('Lincoln Cent');
    expect(csvCell('')).toBe('');
  });

  it.each(['=', '+', '-', '@'])('prefixes a leading %s with a single quote', (char) => {
    expect(csvCell(`${char}cmd`)).toBe(`'${char}cmd`);
  });

  it('does not prefix those characters when they are not first', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('1-2')).toBe('1-2');
  });

  it('does not prefix when a space comes before the formula character', () => {
    expect(csvCell(' =x')).toBe(' =x');
  });

  it('doubles inner quotes and wraps the cell', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps a value with a comma', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('wraps a value with a line feed', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('wraps a value with a carriage return', () => {
    expect(csvCell('a\rb')).toBe('"a\rb"');
  });

  it('applies the prefix before the quoting', () => {
    expect(csvCell('=a,b')).toBe('"\'=a,b"');
  });
});

describe('csvRow', () => {
  it('runs each cell through csvCell and joins with commas', () => {
    expect(csvRow(['a', 'b,c', '=x', ''])).toBe('a,"b,c",\'=x,');
  });

  it('gives a different result for different cells', () => {
    expect(csvRow(['x', 'y'])).toBe('x,y');
    expect(csvRow(['y', 'x'])).toBe('y,x');
  });
});

describe('csvDocument', () => {
  it('starts with the BOM and joins lines with CRLF, with no trailing CRLF', () => {
    const doc = csvDocument(['h1,h2', 'a,b', 'c,d']);
    expect(doc).toBe(`${BOM}h1,h2\r\na,b\r\nc,d`);
    expect(doc.endsWith('\r\n')).toBe(false);
  });

  it('a single line gives the BOM plus that line', () => {
    expect(csvDocument(['only'])).toBe(`${BOM}only`);
  });

  it('uses the lines verbatim (headers with commas or quotes are not escaped)', () => {
    expect(csvDocument(['A,"B"', '=x'])).toBe(`${BOM}A,"B"\r\n=x`);
  });
});

describe('formatLocalDate', () => {
  it('formats local year, month and day, zero padded', () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(formatLocalDate(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
  });

  it('pads the year to four digits', () => {
    const date = new Date(2000, 0, 1);
    date.setFullYear(5, 0, 1);
    expect(formatLocalDate(date)).toBe('0005-01-01');
  });

  it('is still re-exported from @/lib/missing-list and gives the same result', () => {
    const date = new Date(2026, 5, 9, 12);
    expect(missingListFormatLocalDate(date)).toBe('2026-06-09');
    expect(missingListFormatLocalDate(date)).toBe(formatLocalDate(date));
  });
});

describe('buildMissingCsv golden bytes (byte-identical to the pre-refactor output)', () => {
  const baseCoin = {
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const gaps = {
    slots: [
      {
        id: 's2',
        position: 2,
        owned: false,
        coin: {
          ...baseCoin,
          id: 'c2',
          name: 'Say "hi", friend',
          country: 'Ukraine',
          denomination: '5 Kopiyok',
          year: 2011,
          mintMark: '',
          variety: 'Line\nBreak',
          mintage: null,
          isKeyDate: false,
        },
      },
      {
        id: 's3',
        position: 3,
        owned: true,
        coin: {
          ...baseCoin,
          id: 'c3',
          name: 'Owned coin',
          country: 'USA',
          denomination: '1 Cent',
          year: 1944,
          mintMark: '',
          variety: '',
          mintage: 100,
          isKeyDate: false,
        },
      },
      {
        id: 's1',
        position: 1,
        owned: false,
        coin: {
          ...baseCoin,
          id: 'c1',
          name: '=SUM(A1)',
          country: 'USA',
          denomination: '1 Cent',
          year: 1909,
          mintMark: 'S',
          variety: 'VDB',
          mintage: 484000,
          isKeyDate: true,
        },
      },
    ],
  } as never;

  it('equals the hard-coded expected string', () => {
    const expected =
      '﻿' +
      'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage' +
      '\r\n' +
      "'=SUM(A1),USA,1 Cent,1909,S,VDB,yes,484000" +
      '\r\n' +
      '"Say ""hi"", friend",Ukraine,5 Kopiyok,2011,,"Line\nBreak",no,';
    expect(buildMissingCsv(gaps, 'Any set')).toBe(expected);
  });

  it('keeps the header constant and gives only BOM + header when nothing is missing', () => {
    expect(MISSING_CSV_HEADER).toBe('Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage');
    expect(buildMissingCsv({ slots: [] } as never, 'Any set')).toBe(`${BOM}${MISSING_CSV_HEADER}`);
  });
});
