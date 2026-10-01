/**
 * Tests for: @/lib/missing-list
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Module: missing-list
 * Covers criteria: #1, #2, #3, #4, #5, #6, #9 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  MISSING_CSV_HEADER,
  buildMissingCsv,
  downloadMissingCsv,
  formatLocalDate,
  getMissingSlots,
  missingCsvFilename,
  slugifySetName,
} from '@/lib/missing-list';

const BOM = '﻿';

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: 484000,
  isKeyDate: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function slot(id: string, position: number, owned: boolean, coin: Partial<typeof BASE_COIN> = {}) {
  return { id, position, owned, coin: { ...BASE_COIN, id: `coin-${id}`, ...coin } };
}

function gapsOf(slots: ReturnType<typeof slot>[]) {
  return { slots } as never;
}

describe('getMissingSlots', () => {
  it('returns only unowned slots sorted ascending by position', () => {
    const gaps = gapsOf([
      slot('c', 7, false),
      slot('owned', 1, true),
      slot('a', 0, false),
      slot('b', 3, false),
      slot('owned2', 5, true),
    ]);

    expect(getMissingSlots(gaps).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when every slot is owned or there are no slots', () => {
    expect(getMissingSlots(gapsOf([slot('a', 0, true), slot('b', 1, true)]))).toEqual([]);
    expect(getMissingSlots(gapsOf([]))).toEqual([]);
  });

  it('does not mutate the input slots array or its order', () => {
    const slots = [slot('c', 7, false), slot('a', 0, false), slot('o', 3, true)];
    const before = [...slots];

    const result = getMissingSlots({ slots } as never);

    expect(slots).toEqual(before);
    expect(slots.map((s) => s.id)).toEqual(['c', 'a', 'o']);
    expect(result).not.toBe(slots);
  });
});

describe('buildMissingCsv', () => {
  it('exports the fixed English header constant', () => {
    expect(MISSING_CSV_HEADER).toBe('Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage');
  });

  it('starts with the BOM, then the header, then rows in position order separated by CRLF with no trailing CRLF', () => {
    const gaps = gapsOf([
      slot('b', 2, false, { name: 'Second', year: 1911 }),
      slot('x', 1, true, { name: 'Owned' }),
      slot('a', 0, false, { name: 'First', year: 1910 }),
    ]);

    const csv = buildMissingCsv(gaps, 'My Set');

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(
      BOM +
        [
          MISSING_CSV_HEADER,
          'First,USA,1 Cent,1910,S,VDB,yes,484000',
          'Second,USA,1 Cent,1911,S,VDB,yes,484000',
        ].join('\r\n'),
    );
    expect(csv.endsWith('\r\n')).toBe(false);
    expect(csv).not.toContain('Owned');
  });

  it('is only the BOM plus header when nothing is missing', () => {
    expect(buildMissingCsv(gapsOf([slot('a', 0, true)]), 'Set')).toBe(BOM + MISSING_CSV_HEADER);
    expect(buildMissingCsv(gapsOf([]), 'Set')).toBe(BOM + MISSING_CSV_HEADER);
  });

  it('does not depend on the set name in the body', () => {
    const gaps = gapsOf([slot('a', 0, false)]);
    expect(buildMissingCsv(gaps, 'One')).toBe(buildMissingCsv(gaps, 'Completely Different'));
  });

  it('renders empty mintMark and variety as empty cells and null mintage as an empty cell', () => {
    const csv = buildMissingCsv(
      gapsOf([slot('a', 0, false, { mintMark: '', variety: '', mintage: null, isKeyDate: false })]),
      'Set',
    );

    expect(csv).toBe(BOM + [MISSING_CSV_HEADER, 'Lincoln Wheat Cent,USA,1 Cent,1909,,,no,'].join('\r\n'));
  });

  it('renders isKeyDate as yes or no and mintage without thousands separators', () => {
    const csv = buildMissingCsv(
      gapsOf([
        slot('a', 0, false, { isKeyDate: true, mintage: 1234567 }),
        slot('b', 1, false, { isKeyDate: false, mintage: 0 }),
      ]),
      'Set',
    );
    const lines = csv.split('\r\n');

    expect(lines[1]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,S,VDB,yes,1234567');
    expect(lines[2]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,S,VDB,no,0');
  });

  it('wraps cells containing commas, quotes, CR or LF in quotes and doubles embedded quotes', () => {
    const csv = buildMissingCsv(
      gapsOf([
        slot('a', 0, false, { name: 'Cent, "Wheat"' }),
        slot('b', 1, false, { name: 'Line\nBreak' }),
        slot('c', 2, false, { name: 'Carriage\rReturn' }),
        slot('d', 3, false, { name: 'Plain' }),
      ]),
      'Set',
    );
    const body = csv.slice(BOM.length);

    expect(body).toContain('"Cent, ""Wheat""",USA,');
    expect(body).toContain('"Line\nBreak",USA,');
    expect(body).toContain('"Carriage\rReturn",USA,');
    expect(body).toContain('\r\nPlain,USA,');
  });

  it('prefixes cells starting with = + - @ with a single quote', () => {
    const csv = buildMissingCsv(
      gapsOf([
        slot('a', 0, false, { name: '@foo' }),
        slot('b', 1, false, { name: '-1' }),
        slot('c', 2, false, { name: '+cmd' }),
        slot('d', 3, false, { name: '=1+1' }),
        slot('e', 4, false, { name: 'a=b' }),
      ]),
      'Set',
    );
    const lines = csv.slice(BOM.length).split('\r\n');

    expect(lines[1].startsWith("'@foo,")).toBe(true);
    expect(lines[2].startsWith("'-1,")).toBe(true);
    expect(lines[3].startsWith("'+cmd,")).toBe(true);
    expect(lines[4].startsWith("'=1+1,")).toBe(true);
    expect(lines[5].startsWith('a=b,')).toBe(true);
  });

  it('applies the formula prefix before RFC 4180 quoting', () => {
    const csv = buildMissingCsv(gapsOf([slot('a', 0, false, { name: '=SUM(A1,B1)' })]), 'Set');

    expect(csv.slice(BOM.length).split('\r\n')[1].startsWith('"\'=SUM(A1,B1)",USA,')).toBe(true);
  });

  it('applies the formula prefix to non-name text cells such as variety', () => {
    const csv = buildMissingCsv(gapsOf([slot('a', 0, false, { variety: '@bad' })]), 'Set');

    expect(csv.slice(BOM.length).split('\r\n')[1]).toBe("Lincoln Wheat Cent,USA,1 Cent,1909,S,'@bad,yes,484000");
  });
});

describe('slugifySetName', () => {
  it('lowercases and hyphenates whitespace', () => {
    expect(slugifySetName('Lincoln Wheat Cents')).toBe('lincoln-wheat-cents');
    expect(slugifySetName('Other Set')).toBe('other-set');
  });

  it('transliterates accents and collapses punctuation', () => {
    expect(slugifySetName('Señor  Peso: 1¢ & Más!')).toBe('senor-peso-1-mas');
  });

  it('strips leading and trailing hyphens and punctuation', () => {
    expect(slugifySetName('  --Été!!  ')).toBe('ete');
  });

  it('falls back to "set" when the slug would be empty', () => {
    expect(slugifySetName('日本')).toBe('set');
    expect(slugifySetName('')).toBe('set');
  });
});

describe('formatLocalDate', () => {
  it('formats local date as zero-padded YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2026, 9, 1))).toBe('2026-10-01');
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(formatLocalDate(new Date(1999, 11, 31, 0, 0, 1))).toBe('1999-12-31');
  });
});

describe('missingCsvFilename', () => {
  it('builds {slug}-missing-{date}.csv', () => {
    expect(missingCsvFilename('Lincoln Wheat Cents', new Date(2026, 9, 1))).toBe(
      'lincoln-wheat-cents-missing-2026-10-01.csv',
    );
    expect(missingCsvFilename('Morgan Dollars', new Date(2025, 2, 14))).toBe('morgan-dollars-missing-2025-03-14.csv');
  });

  it('uses the "set" fallback slug', () => {
    expect(missingCsvFilename('日本', new Date(2026, 9, 1))).toBe('set-missing-2026-10-01.csv');
  });
});

describe('downloadMissingCsv', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { download: string; href: string }[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL.mockReturnValue('blob:mock-url');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clicked = [];
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  function readBytes(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  it('creates a utf-8 CSV Blob containing buildMissingCsv output starting with the BOM bytes', async () => {
    const gaps = gapsOf([slot('b', 1, false, { name: 'Señor' }), slot('a', 0, false, { name: 'Alpha' })]);

    downloadMissingCsv(gaps, 'My Set', new Date(2026, 9, 1));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = await readBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(buildMissingCsv(gaps, 'My Set'));
  });

  it('clicks one anchor whose download is the dated filename and href is the object URL', () => {
    const gaps = gapsOf([slot('a', 0, false)]);

    downloadMissingCsv(gaps, 'Lincoln Wheat Cents', new Date(2026, 9, 1));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('lincoln-wheat-cents-missing-2026-10-01.csv');
    expect(clicked[0].href).toBe('blob:mock-url');
  });

  it('uses the supplied date for the filename', () => {
    downloadMissingCsv(gapsOf([slot('a', 0, false)]), 'Set', new Date(2024, 1, 29));

    expect(clicked[0].download).toBe('set-missing-2024-02-29.csv');
  });

  it('revokes the object URL asynchronously, not synchronously', async () => {
    downloadMissingCsv(gapsOf([slot('a', 0, false)]), 'Set', new Date(2026, 9, 1));

    expect(revokeObjectURL).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not leave an anchor attached to the document', () => {
    const before = document.querySelectorAll('a').length;

    downloadMissingCsv(gapsOf([slot('a', 0, false)]), 'Set', new Date(2026, 9, 1));

    expect(document.querySelectorAll('a').length).toBe(before);
  });
});
