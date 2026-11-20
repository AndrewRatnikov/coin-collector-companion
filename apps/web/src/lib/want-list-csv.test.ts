/**
 * Tests for: @/lib/missing-list (combined want list additions)
 * Contract source: runs/run_20261120_215525/plan.md § Interface Contract → Module: missing-list.ts (MODIFY)
 * Covers criteria: #12 (from prd.md), and the wantCoinLabel label of the disclosure (#7)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { CatalogCoin, WantListResponse } from '@coin-collector/shared';
import {
  MISSING_CSV_HEADER,
  WANT_LIST_CSV_HEADER,
  buildMissingCsv,
  buildWantListCsv,
  downloadWantListCsv,
  wantCoinLabel,
  wantListCsvFilename,
} from '@/lib/missing-list';

const BOM = '﻿';

function makeCoin(over: Partial<CatalogCoin> & Pick<CatalogCoin, 'id'>): CatalogCoin {
  return {
    country: 'USA',
    denomination: '1 Cent',
    year: 1909,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as CatalogCoin;
}

function lines(csv: string): string[] {
  return csv.slice(BOM.length).split('\r\n');
}

const SET_A = { id: 'set-a', name: 'Wheat Cents' };
const SET_B = { id: 'set-b', name: 'Mixed Coins' };

describe('WANT_LIST_CSV_HEADER', () => {
  it('is the per-set header plus a final Sets column', () => {
    expect(WANT_LIST_CSV_HEADER).toBe(
      'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage,Want,Grade,Target grade,Sets',
    );
    expect(WANT_LIST_CSV_HEADER).toBe(`${MISSING_CSV_HEADER},Sets`);
  });
});

describe('buildWantListCsv', () => {
  it('returns the BOM and only the header for an empty response', () => {
    expect(buildWantListCsv({ setCount: 2, missing: [], upgrades: [] })).toBe(BOM + WANT_LIST_CSV_HEADER);
  });

  it('writes a missing row with the coin cells, "missing", empty grades and the set names', () => {
    const response: WantListResponse = {
      setCount: 2,
      missing: [
        {
          coin: makeCoin({ id: 'c1', year: 1914, mintMark: 'D', isKeyDate: true, mintage: 1193000 }),
          sets: [SET_A],
        },
      ],
      upgrades: [],
    };

    expect(lines(buildWantListCsv(response))).toEqual([
      WANT_LIST_CSV_HEADER,
      'Lincoln Wheat Cent,USA,1 Cent,1914,D,,yes,1193000,missing,,,Wheat Cents',
    ]);
  });

  it('joins the names of several sets with "; "', () => {
    const response: WantListResponse = {
      setCount: 2,
      missing: [{ coin: makeCoin({ id: 'c1' }), sets: [SET_A, SET_B] }],
      upgrades: [],
    };

    expect(lines(buildWantListCsv(response))[1].endsWith(',missing,,,Wheat Cents; Mixed Coins')).toBe(true);
  });

  it('gives a different Sets cell for a different set list', () => {
    const one = buildWantListCsv({ setCount: 1, missing: [{ coin: makeCoin({ id: 'c1' }), sets: [SET_B] }], upgrades: [] });
    const two = buildWantListCsv({
      setCount: 2,
      missing: [{ coin: makeCoin({ id: 'c1' }), sets: [SET_A, SET_B] }],
      upgrades: [],
    });

    expect(lines(one)[1].endsWith(',Mixed Coins')).toBe(true);
    expect(lines(two)[1].endsWith(',Wheat Cents; Mixed Coins')).toBe(true);
  });

  it('writes an upgrade row with its grade, target grade and set names', () => {
    const response: WantListResponse = {
      setCount: 1,
      missing: [],
      upgrades: [{ coin: makeCoin({ id: 'u1', year: 1920, mintMark: 'D' }), sets: [SET_A], grade: 'F', targetGrade: 'VF' }],
    };

    expect(lines(buildWantListCsv(response))[1]).toBe(
      'Lincoln Wheat Cent,USA,1 Cent,1920,D,,no,,upgrade,F,VF,Wheat Cents',
    );
  });

  it('leaves the Grade cell empty for an ungraded upgrade and follows the target grade', () => {
    const make = (targetGrade: 'VF' | 'UNC') =>
      buildWantListCsv({
        setCount: 1,
        missing: [],
        upgrades: [{ coin: makeCoin({ id: 'u1' }), sets: [SET_A], grade: null, targetGrade }],
      });

    expect(lines(make('VF'))[1]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,,,no,,upgrade,,VF,Wheat Cents');
    expect(lines(make('UNC'))[1]).toBe('Lincoln Wheat Cent,USA,1 Cent,1909,,,no,,upgrade,,UNC,Wheat Cents');
  });

  it('writes every missing row first, then every upgrade row, each in response order', () => {
    const response: WantListResponse = {
      setCount: 2,
      missing: [
        { coin: makeCoin({ id: 'm1', name: 'M-one', year: 1950 }), sets: [SET_A] },
        { coin: makeCoin({ id: 'm2', name: 'M-two', country: 'Ukraine', denomination: '5 Kopiyok', year: 2011 }), sets: [SET_B] },
        { coin: makeCoin({ id: 'm3', name: 'M-three', year: 1909 }), sets: [SET_A] },
      ],
      upgrades: [
        { coin: makeCoin({ id: 'u1', name: 'U-one', year: 1930 }), sets: [SET_A], grade: 'G', targetGrade: 'VF' },
        { coin: makeCoin({ id: 'u2', name: 'U-two', year: 1920 }), sets: [SET_A], grade: null, targetGrade: 'VF' },
      ],
    };

    const rows = lines(buildWantListCsv(response)).slice(1);
    expect(rows.map((r) => r.split(',')[0])).toEqual(['M-one', 'M-two', 'M-three', 'U-one', 'U-two']);
    expect(rows.map((r) => r.split(',')[8])).toEqual(['missing', 'missing', 'missing', 'upgrade', 'upgrade']);
  });

  it('keeps the first eleven cells identical to the per-set CSV for the same coin', () => {
    const coin = makeCoin({ id: 'c1', year: 1914, mintMark: 'D', isKeyDate: true, mintage: 1193000, variety: 'Series One: Donetsk Oblast' });
    const slots = [{ id: 'usc-1', position: 0, coin, owned: false, grade: null }];
    const perSet = lines(buildMissingCsv({ slots } as never, 'Any'))[1];
    const combined = lines(buildWantListCsv({ setCount: 1, missing: [{ coin, sets: [SET_A] }], upgrades: [] }))[1];

    expect(combined).toBe(`${perSet},Wheat Cents`);
  });

  it('quotes cells with commas and doubles embedded quotes, set names included', () => {
    const response: WantListResponse = {
      setCount: 1,
      missing: [
        {
          coin: makeCoin({ id: 'c1', name: 'Cent, "Wheat"' }),
          sets: [{ id: 's', name: 'Early, Rare' }],
        },
      ],
      upgrades: [],
    };

    const row = lines(buildWantListCsv(response))[1];
    expect(row.startsWith('"Cent, ""Wheat""",USA,')).toBe(true);
    expect(row.endsWith(',missing,,,"Early, Rare"')).toBe(true);
  });

  it('prefixes formula-looking text with an apostrophe, in the Sets cell too', () => {
    const response: WantListResponse = {
      setCount: 1,
      missing: [{ coin: makeCoin({ id: 'c1', name: '=SUM(A1:A2)' }), sets: [{ id: 's', name: '@evil' }] }],
      upgrades: [],
    };

    const row = lines(buildWantListCsv(response))[1];
    expect(row.startsWith("'=SUM(A1:A2),USA,")).toBe(true);
    expect(row.endsWith(",'@evil")).toBe(true);
  });

  it('separates lines with CRLF and has no trailing newline', () => {
    const csv = buildWantListCsv({
      setCount: 1,
      missing: [{ coin: makeCoin({ id: 'c1' }), sets: [SET_A] }],
      upgrades: [],
    });

    expect(csv.startsWith(BOM + WANT_LIST_CSV_HEADER + '\r\n')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(false);
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('does not mutate the response', () => {
    const response: WantListResponse = {
      setCount: 1,
      missing: [{ coin: makeCoin({ id: 'c1' }), sets: [SET_A, SET_B] }],
      upgrades: [],
    };
    const before = JSON.stringify(response);

    buildWantListCsv(response);

    expect(JSON.stringify(response)).toBe(before);
  });
});

describe('wantListCsvFilename', () => {
  it('is want-list-YYYY-MM-DD.csv in local time', () => {
    expect(wantListCsvFilename(new Date(2026, 10, 20))).toBe('want-list-2026-11-20.csv');
  });

  it('follows the date it is given and zero-pads month and day', () => {
    expect(wantListCsvFilename(new Date(2025, 2, 4))).toBe('want-list-2025-03-04.csv');
  });
});

describe('downloadWantListCsv', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { download: string; href: string }[];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  const RESPONSE: WantListResponse = {
    setCount: 1,
    missing: [{ coin: makeCoin({ id: 'c1', name: 'Señor' }), sets: [SET_A] }],
    upgrades: [],
  };

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

  it('creates a utf-8 CSV Blob holding buildWantListCsv output, starting with the BOM bytes', async () => {
    downloadWantListCsv(RESPONSE, new Date(2026, 10, 20));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = await readBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(buildWantListCsv(RESPONSE));
  });

  it('clicks one anchor whose download is the dated filename and href is the object URL', () => {
    downloadWantListCsv(RESPONSE, new Date(2026, 10, 20));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('want-list-2026-11-20.csv');
    expect(clicked[0].href).toBe('blob:mock-url');
  });

  it('uses the supplied date for the filename', () => {
    downloadWantListCsv(RESPONSE, new Date(2024, 1, 29));

    expect(clicked[0].download).toBe('want-list-2024-02-29.csv');
  });

  it('defaults the date to now', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 2, 15, 12, 0, 0));
    try {
      downloadWantListCsv(RESPONSE);
    } finally {
      vi.useRealTimers();
    }

    expect(clicked[0].download).toBe('want-list-2027-03-15.csv');
  });

  it('revokes the object URL asynchronously, not synchronously', async () => {
    downloadWantListCsv(RESPONSE, new Date(2026, 10, 20));

    expect(revokeObjectURL).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not leave an anchor attached to the document', () => {
    const before = document.querySelectorAll('a').length;

    downloadWantListCsv(RESPONSE, new Date(2026, 10, 20));

    expect(document.querySelectorAll('a').length).toBe(before);
  });
});

describe('wantCoinLabel', () => {
  it('joins country, denomination and year-mint with " · "', () => {
    expect(wantCoinLabel(makeCoin({ id: 'c1', year: 1914, mintMark: 'D' }))).toBe('USA · 1 Cent · 1914-D');
  });

  it('shows just the year for a plain coin and changes with the year and mint mark', () => {
    expect(wantCoinLabel(makeCoin({ id: 'c1', year: 1909 }))).toBe('USA · 1 Cent · 1909');
    expect(wantCoinLabel(makeCoin({ id: 'c1', year: 1909, mintMark: 'S' }))).toBe('USA · 1 Cent · 1909-S');
  });

  it('appends the design of the variety, without its series prefix', () => {
    expect(
      wantCoinLabel(
        makeCoin({
          id: 'c1',
          country: 'Ukraine',
          denomination: '5 Kopiyok',
          year: 2011,
          variety: 'Series One: Donetsk Oblast',
        }),
      ),
    ).toBe('Ukraine · 5 Kopiyok · 2011 · Donetsk Oblast');
  });

  it('keeps a variety that has no series prefix and trims blanks', () => {
    expect(wantCoinLabel(makeCoin({ id: 'c1', year: 1909, mintMark: ' S ', variety: ' Doubled die ' }))).toBe(
      'USA · 1 Cent · 1909-S · Doubled die',
    );
  });

  it('drops empty parts instead of leaving stray separators', () => {
    expect(wantCoinLabel(makeCoin({ id: 'c1', denomination: '', year: 1909 }))).toBe('USA · 1909');
  });
});
