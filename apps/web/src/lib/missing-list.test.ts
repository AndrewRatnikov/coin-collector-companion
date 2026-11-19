/**
 * Tests for: @/lib/missing-list
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Module: missing-list
 *                   runs/run_20261117_063301/plan.md § Interface Contract → Function: groupWantList
 *                   runs/run_20261119_210926/plan.md § Interface Contract → Module: missing-list
 * Covers criteria: #1, #2, #3, #4, #5, #6, #9 (from prd.md), #14 of run_20261117_063301,
 *                  and #2, #3, #4, #13, #15 of run_20261119_210926
 *
 * run_20261117_063301: the groupWantList block is unchanged.
 * run_20261119_210926: the header constant and full-row expectations carry the new Want, Grade and
 * Target grade columns; the buildWantGroups, getUpgradeSlots and CSV order/upgrade blocks are added.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  MISSING_CSV_HEADER,
  buildMissingCsv,
  buildWantGroups,
  downloadMissingCsv,
  formatLocalDate,
  getMissingSlots,
  getUpgradeSlots,
  groupWantList,
  missingCsvFilename,
  slugifySetName,
} from '@/lib/missing-list';
import {
  LINCOLN_SAMPLE_KEY_DATE_IDS,
  LINCOLN_SAMPLE_MOBILE_SLOTS,
  LINCOLN_SAMPLE_SLOTS,
} from '@/lib/landing/lincoln-sample';

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

function slot(
  id: string,
  position: number,
  owned: boolean,
  coin: Partial<Omit<typeof BASE_COIN, 'mintage'>> & { mintage?: number | null } = {},
) {
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
  it('exports the fixed English header constant with the Want, Grade and Target grade columns', () => {
    expect(MISSING_CSV_HEADER).toBe(
      'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage,Want,Grade,Target grade',
    );
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
          'First,USA,1 Cent,1910,S,VDB,yes,484000,missing,,',
          'Second,USA,1 Cent,1911,S,VDB,yes,484000,missing,,',
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

    expect(csv).toBe(BOM + [MISSING_CSV_HEADER, 'Lincoln Wheat Cent,USA,1 Cent,1909,,,no,,missing,,'].join('\r\n'));
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

    expect(lines[1]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,S,VDB,yes,1234567,missing,,');
    expect(lines[2]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,S,VDB,no,0,missing,,');
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

    expect(csv.slice(BOM.length).split('\r\n')[1]).toBe(
      "Lincoln Wheat Cent,USA,1 Cent,1909,S,'@bad,yes,484000,missing,,",
    );
  });
});

describe('buildMissingCsv: want-list order and upgrade rows', () => {
  it('orders missing rows by group, then year, keeping position order inside a year', () => {
    const gaps = gapsOf([
      slot('p0', 0, false, { name: 'P0', year: 1909 }),
      slot('p1', 1, false, { name: 'P1', country: 'Ukraine', denomination: '5 Kopiyok', year: 2011 }),
      slot('p2', 2, false, { name: 'P2', year: 1910 }),
      slot('p3', 3, false, { name: 'P3', year: 1909 }),
      slot('p4', 4, false, { name: 'P4', country: 'Ukraine', denomination: '5 Kopiyok', year: 2010 }),
    ]);

    const names = buildMissingCsv(gaps, 'Set')
      .slice(BOM.length)
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(',')[0]);

    // USA|1 Cent: 1909 (P0, P3), 1910 (P2); then Ukraine|5 Kopiyok: 2011 (P1), 2010 (P4)
    expect(names).toEqual(['P0', 'P3', 'P2', 'P1', 'P4']);
  });

  it('appends upgrade rows after the missing rows with the owned grade and the target grade', () => {
    const gaps = {
      minGrade: 'VF',
      slots: [
        { ...slot('u', 0, true, { name: 'Upgrade me', year: 1909 }), grade: 'F', needsUpgrade: true },
        { ...slot('m', 1, false, { name: 'Missing one', year: 1915 }), grade: null },
        { ...slot('ok', 2, true, { name: 'Fine as is', year: 1920 }), grade: 'XF', needsUpgrade: false },
      ],
    } as never;

    const lines = buildMissingCsv(gaps, 'Set').slice(BOM.length).split('\r\n');

    expect(lines).toEqual([
      MISSING_CSV_HEADER,
      'Missing one,USA,1 Cent,1915,S,VDB,yes,484000,missing,,',
      'Upgrade me,USA,1 Cent,1909,S,VDB,yes,484000,upgrade,F,VF',
    ]);
    expect(lines.join('\n')).not.toContain('Fine as is');
  });

  it('writes an empty Grade cell for an ungraded owned coin and follows the minGrade code', () => {
    const make = (minGrade: string) =>
      ({
        minGrade,
        slots: [{ ...slot('u', 0, true), grade: null, needsUpgrade: true }],
      }) as never;

    const vf = buildMissingCsv(make('VF'), 'Set').slice(BOM.length).split('\r\n')[1];
    const unc = buildMissingCsv(make('UNC'), 'Set').slice(BOM.length).split('\r\n')[1];

    expect(vf.endsWith(',upgrade,,VF')).toBe(true);
    expect(unc.endsWith(',upgrade,,UNC')).toBe(true);
  });

  it('orders upgrade rows in want-list order too', () => {
    const gaps = {
      minGrade: 'VF',
      slots: [
        { ...slot('a', 0, true, { name: 'A', year: 1909 }), grade: 'G', needsUpgrade: true },
        {
          ...slot('b', 1, true, { name: 'B', country: 'Ukraine', denomination: '5 Kopiyok', year: 2011 }),
          grade: 'G',
          needsUpgrade: true,
        },
        { ...slot('c', 2, true, { name: 'C', year: 1910 }), grade: 'G', needsUpgrade: true },
        { ...slot('d', 3, true, { name: 'D', year: 1909 }), grade: 'G', needsUpgrade: true },
      ],
    } as never;

    const names = buildMissingCsv(gaps, 'Set')
      .slice(BOM.length)
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(',')[0]);

    expect(names).toEqual(['A', 'D', 'C', 'B']);
  });

  it('writes only missing rows when the set has no minimum grade', () => {
    const csv = buildMissingCsv(gapsOf([slot('a', 0, false), slot('b', 1, true)]), 'Set');
    const lines = csv.slice(BOM.length).split('\r\n');

    expect(lines).toHaveLength(2);
    expect(csv).not.toContain('upgrade');
  });

  it('is only the BOM plus header when nothing is missing and nothing needs an upgrade', () => {
    const gaps = { minGrade: 'VF', slots: [{ ...slot('a', 0, true), grade: 'XF', needsUpgrade: false }] } as never;

    expect(buildMissingCsv(gaps, 'Set')).toBe(BOM + MISSING_CSV_HEADER);
  });
});

describe('getUpgradeSlots', () => {
  it('returns owned slots with needsUpgrade true, ascending by position', () => {
    const gaps = {
      slots: [
        { ...slot('c', 7, true), needsUpgrade: true },
        { ...slot('skip-fine', 1, true), needsUpgrade: false },
        { ...slot('a', 0, true), needsUpgrade: true },
        { ...slot('skip-missing', 2, false) },
        { ...slot('b', 3, true), needsUpgrade: true },
      ],
    } as never;

    expect(getUpgradeSlots(gaps).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] when no slot has needsUpgrade (set without a minimum grade)', () => {
    expect(getUpgradeSlots(gapsOf([slot('a', 0, true), slot('b', 1, false)]))).toEqual([]);
    expect(getUpgradeSlots(gapsOf([]))).toEqual([]);
  });

  it('does not mutate the input', () => {
    const slots = [
      { ...slot('c', 7, true), needsUpgrade: true },
      { ...slot('a', 0, true), needsUpgrade: true },
    ];
    const before = [...slots];

    const result = getUpgradeSlots({ slots } as never);

    expect(slots.map((s) => s.id)).toEqual(before.map((s) => s.id));
    expect(result).not.toBe(slots);
  });
});

describe('buildWantGroups', () => {
  function item(
    id: string,
    coin: Partial<Omit<typeof BASE_COIN, 'mintage'>> = {},
    extra: { grade?: string | null; targetGrade?: string | null } = {},
  ) {
    return { coin: { ...BASE_COIN, id: `coin-${id}`, ...coin }, ...extra };
  }

  it('returns [] for no items', () => {
    expect(buildWantGroups([])).toEqual([]);
  });

  it('builds one group with years in order of first appearance and mints in input order', () => {
    const groups = buildWantGroups([
      item('a', { year: 1914, mintMark: 'D', variety: '', isKeyDate: true }),
      item('b', { year: 1909, mintMark: 'S', variety: 'VDB', isKeyDate: true }),
      item('c', { year: 1914, mintMark: 'S', variety: '', isKeyDate: false }),
    ] as never);

    expect(groups).toEqual([
      {
        key: 'USA|1 Cent',
        country: 'USA',
        denomination: '1 Cent',
        years: [
          {
            year: 1914,
            mints: [
              { label: 'D', isKeyDate: true },
              { label: 'S', isKeyDate: false },
            ],
          },
          { year: 1909, mints: [{ label: 'S VDB', isKeyDate: true }] },
        ],
      },
    ]);
  });

  it('keeps two denominations of the same year in two groups, in order of first appearance', () => {
    const groups = buildWantGroups([
      item('a', { year: 1944, denomination: '1 Cent' }),
      item('b', { year: 1944, denomination: '5 Cents' }),
      item('c', { year: 1945, denomination: '1 Cent' }),
      item('d', { year: 1944, country: 'Canada', denomination: '1 Cent' }),
    ] as never);

    expect(groups.map((g) => g.key)).toEqual(['USA|1 Cent', 'USA|5 Cents', 'Canada|1 Cent']);
    expect(groups[0].years.map((y) => y.year)).toEqual([1944, 1945]);
    expect(groups[1].years.map((y) => y.year)).toEqual([1944]);
    expect(groups[2].country).toBe('Canada');
    expect(groups[2].denomination).toBe('1 Cent');
  });

  it('never sorts: groups and years follow the caller order', () => {
    const groups = buildWantGroups([
      item('a', { year: 1930 }),
      item('b', { year: 1910 }),
      item('c', { year: 1920 }),
    ] as never);

    expect(groups[0].years.map((y) => y.year)).toEqual([1930, 1910, 1920]);
  });

  it('does not mutate the input', () => {
    const items = [item('a', { year: 1930 }), item('b', { year: 1910 })];
    const snapshot = JSON.stringify(items);

    buildWantGroups(items as never);

    expect(JSON.stringify(items)).toBe(snapshot);
  });

  it('labels a mint with the mint mark plus the design part of the variety', () => {
    const groups = buildWantGroups([
      item('a', { mintMark: 'S', variety: 'VDB' }),
      item('b', { mintMark: '', variety: 'We Are Strong: Donetsk Oblast', year: 2025 }),
      item('c', { mintMark: 'D', variety: 'We Are Strong: Kyiv Oblast', year: 2026 }),
    ] as never);

    const labels = groups[0].years.flatMap((y) => y.mints.map((m) => m.label));
    expect(labels).toEqual(['S VDB', 'Donetsk Oblast', 'D Kyiv Oblast']);
  });

  it('gives an empty label for a plain coin and trims the mint mark and variety', () => {
    const groups = buildWantGroups([
      item('a', { mintMark: '', variety: '', year: 1911, isKeyDate: false }),
      item('b', { mintMark: ' D ', variety: '  VDB ', year: 1912 }),
    ] as never);

    expect(groups[0].years[0].mints).toEqual([{ label: '', isKeyDate: false }]);
    expect(groups[0].years[1].mints[0].label).toBe('D VDB');
  });

  it('reads isKeyDate from the coin', () => {
    const groups = buildWantGroups([
      item('a', { year: 1914, mintMark: 'D', variety: '', isKeyDate: true }),
      item('b', { year: 1914, mintMark: 'S', variety: '', isKeyDate: false }),
    ] as never);

    expect(groups[0].years[0].mints.map((m) => m.isKeyDate)).toEqual([true, false]);
  });

  it('gives a missing mint exactly { label, isKeyDate } with no grade keys', () => {
    const groups = buildWantGroups([item('a', { mintMark: 'D', variety: '', isKeyDate: false })] as never);

    expect(groups[0].years[0].mints[0]).toEqual({ label: 'D', isKeyDate: false });
    expect(Object.keys(groups[0].years[0].mints[0]).sort()).toEqual(['isKeyDate', 'label']);
  });

  it('copies grade and targetGrade onto the mint, including a null grade', () => {
    const groups = buildWantGroups([
      item('a', { year: 1912, mintMark: 'D', variety: '' }, { grade: 'F', targetGrade: 'VF' }),
      item('b', { year: 1912, mintMark: 'S', variety: '' }, { grade: null, targetGrade: 'VF' }),
    ] as never);

    expect(groups[0].years[0].mints).toEqual([
      { label: 'D', isKeyDate: true, grade: 'F', targetGrade: 'VF' },
      { label: 'S', isKeyDate: true, grade: null, targetGrade: 'VF' },
    ]);
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

  afterEach(async () => {
    // drain the pending setTimeout(..., 0) revoke before restoring URL
    await new Promise((resolve) => setTimeout(resolve, 10));
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate ?? (() => 'blob:noop');
    URL.revokeObjectURL = originalRevoke ?? (() => {});
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

describe('groupWantList', () => {
  it('groups the full sample into 6 year rows over 8 missing coins with key dates starred', () => {
    const rows = groupWantList(LINCOLN_SAMPLE_SLOTS, LINCOLN_SAMPLE_KEY_DATE_IDS);

    expect(rows).toEqual([
      {
        year: 1909,
        mints: [
          { label: 'S', isKeyDate: true },
          { label: 'S VDB', isKeyDate: true },
        ],
      },
      { year: 1910, mints: [{ label: 'S', isKeyDate: false }] },
      { year: 1912, mints: [{ label: 'S', isKeyDate: false }] },
      {
        year: 1914,
        mints: [
          { label: 'D', isKeyDate: true },
          { label: 'S', isKeyDate: false },
        ],
      },
      { year: 1915, mints: [{ label: 'S', isKeyDate: false }] },
      { year: 1916, mints: [{ label: 'S', isKeyDate: false }] },
    ]);
    expect(rows.reduce((total, row) => total + row.mints.length, 0)).toBe(8);
  });

  it('groups the 1909-1912 mobile slice into 3 rows over 4 coins', () => {
    const rows = groupWantList(LINCOLN_SAMPLE_MOBILE_SLOTS, LINCOLN_SAMPLE_KEY_DATE_IDS);

    expect(rows.map((row) => row.year)).toEqual([1909, 1910, 1912]);
    expect(rows.reduce((total, row) => total + row.mints.length, 0)).toBe(4);
  });

  it('returns no rows when nothing is missing or there are no slots', () => {
    expect(groupWantList(LINCOLN_SAMPLE_SLOTS.map((s) => ({ ...s, owned: true })), LINCOLN_SAMPLE_KEY_DATE_IDS)).toEqual([]);
    expect(groupWantList([], new Set())).toEqual([]);
  });

  it('uses an empty label for a plain coin and the variety alone when there is no mint mark', () => {
    const rows = groupWantList(
      [
        slot('plain', 1, false, { year: 1911, mintMark: '', variety: '', isKeyDate: false }),
        slot('vdb', 2, false, { year: 1911, mintMark: '', variety: 'VDB', isKeyDate: false }),
        slot('d', 3, false, { year: 1911, mintMark: 'D', variety: '', isKeyDate: false }),
      ] as never,
      new Set(),
    );

    expect(rows).toEqual([
      {
        year: 1911,
        mints: [
          { label: '', isKeyDate: false },
          { label: 'VDB', isKeyDate: false },
          { label: 'D', isKeyDate: false },
        ],
      },
    ]);
  });

  it('ignores owned slots', () => {
    const rows = groupWantList(
      [
        slot('a', 1, true, { year: 1911, mintMark: 'D', variety: '' }),
        slot('b', 2, false, { year: 1911, mintMark: 'S', variety: '' }),
      ] as never,
      new Set(),
    );

    expect(rows).toEqual([{ year: 1911, mints: [{ label: 'S', isKeyDate: false }] }]);
  });

  it('sorts by position, groups years in order of first appearance and does not mutate the input', () => {
    const slots = [
      slot('late', 9, false, { year: 1913, mintMark: 'S', variety: '' }),
      slot('first', 1, false, { year: 1911, mintMark: 'D', variety: '' }),
      slot('mid', 5, false, { year: 1911, mintMark: 'S', variety: '' }),
    ];
    const before = [...slots];

    const rows = groupWantList(slots as never, new Set());

    expect(rows.map((row) => row.year)).toEqual([1911, 1913]);
    expect(rows[0].mints.map((m) => m.label)).toEqual(['D', 'S']);
    expect(slots).toEqual(before);
    expect(slots.map((s) => s.id)).toEqual(['late', 'first', 'mid']);
  });

  it('takes the key-date flag from keyDateIds by coin id, not from coin.isKeyDate', () => {
    const slots = [
      slot('k', 1, false, { year: 1914, mintMark: 'D', variety: '', isKeyDate: false }),
      slot('n', 2, false, { year: 1914, mintMark: 'S', variety: '', isKeyDate: true }),
    ] as never;

    const flagged = groupWantList(slots, new Set(['coin-k']));
    const none = groupWantList(slots, new Set());

    expect(flagged[0].mints).toEqual([
      { label: 'D', isKeyDate: true },
      { label: 'S', isKeyDate: false },
    ]);
    expect(none[0].mints.every((m) => !m.isKeyDate)).toBe(true);
  });
});
