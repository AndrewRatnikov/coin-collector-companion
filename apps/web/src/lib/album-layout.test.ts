/**
 * Tests for: album-layout (pure layout + formatters)
 * Contract source: runs/run_20261009_211156/plan.md § Interface Contract → Module: album-layout
 * Covers criteria: #3, #4, #5 (all-'' page), #6 (cell holds several slots), #7 (blank cells not counted),
 *                  #8 (counts), #10 (label), #17, #18, #19
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { GapSlot } from '@coin-collector/shared';
import {
  buildAlbumLayout,
  formatAlbumCoinName,
  formatAlbumSlotLabel,
  formatOwnedOfTotal,
} from '@/lib/album-layout';

let seq = 0;
function slot(
  position: number,
  over: {
    id?: string;
    year: number;
    mintMark?: string;
    variety?: string;
    name?: string;
    country?: string;
    denomination?: string;
    owned?: boolean;
    isKeyDate?: boolean;
  },
): GapSlot {
  seq += 1;
  const id = over.id ?? `s${seq}`;
  return {
    id: `usc-${id}`,
    position,
    owned: over.owned ?? false,
    coin: {
      id: `coin-${id}`,
      country: over.country ?? 'USA',
      denomination: over.denomination ?? 'Cent',
      year: over.year,
      mintMark: over.mintMark ?? '',
      variety: over.variety ?? '',
      name: over.name ?? 'Lincoln Wheat Cent',
      imageUrl: null,
      imageSource: null,
      imageLicense: null,
      diameterMm: null,
      weightG: null,
      thicknessMm: null,
      material: null,
      mintage: null,
      isKeyDate: over.isKeyDate ?? false,
      status: 'approved',
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

// Lincoln page: 1909 '' (plain, VDB), 1909 S, 1910 '' , 1910 D. 1909 D and 1910 S are blank.
const L1 = slot(0, { id: 'L1', year: 1909, owned: true });
const L2 = slot(1, { id: 'L2', year: 1909, variety: 'VDB', owned: false });
const L3 = slot(2, { id: 'L3', year: 1909, mintMark: 'S', variety: 'VDB', owned: true });
const L4 = slot(3, { id: 'L4', year: 1910, mintMark: 'D', owned: false });
const L5 = slot(4, { id: 'L5', year: 1910, owned: true });
// Ukrainian page: all mint marks ''
const U1 = slot(10, {
  id: 'U1',
  year: 2026,
  country: 'Ukraine',
  denomination: '1 Hryvnia',
  name: 'Commemorative',
  variety: 'Alpha',
  owned: true,
});
const U2 = slot(11, {
  id: 'U2',
  year: 2026,
  country: 'Ukraine',
  denomination: '1 Hryvnia',
  name: 'Commemorative',
  variety: 'Beta',
  owned: false,
});

describe('buildAlbumLayout', () => {
  it('returns [] for no slots', () => {
    expect(buildAlbumLayout([])).toEqual([]);
  });

  it('makes one page per (country, denomination, name), ordered by first position even with scrambled input', () => {
    const pages = buildAlbumLayout([U2, L5, U1, L3, L1, L4, L2]);

    expect(pages).toHaveLength(2);
    expect(pages[0].name).toBe('Lincoln Wheat Cent');
    expect(pages[0].country).toBe('USA');
    expect(pages[0].denomination).toBe('Cent');
    expect(pages[1].name).toBe('Commemorative');
    expect(pages[1].country).toBe('Ukraine');
    expect(pages[1].denomination).toBe('1 Hryvnia');
  });

  it('orders pages by min position: a series with the lower position comes first', () => {
    const early = slot(0, { id: 'E', year: 2026, country: 'Ukraine', denomination: '1 Hryvnia', name: 'Commemorative' });
    const late = slot(5, { id: 'F', year: 1909 });
    const pages = buildAlbumLayout([late, early]);

    expect(pages.map((p) => p.country)).toEqual(['Ukraine', 'USA']);
  });

  it('keeps series with the same name but different country or denomination on separate pages', () => {
    const a = slot(0, { id: 'A', year: 1990, country: 'USA', denomination: 'Cent', name: 'Same' });
    const b = slot(1, { id: 'B', year: 1990, country: 'Canada', denomination: 'Cent', name: 'Same' });
    const c = slot(2, { id: 'C', year: 1990, country: 'USA', denomination: 'Dime', name: 'Same' });

    expect(buildAlbumLayout([a, b, c])).toHaveLength(3);
  });

  it('gives rows as distinct years ascending, with no gap years', () => {
    const [lincoln] = buildAlbumLayout([L5, L1, L2, L3, L4]);
    expect(lincoln.rows.map((r) => r.year)).toEqual([1909, 1910]);

    const sparse = buildAlbumLayout([slot(0, { year: 1958 }), slot(1, { year: 1909 }), slot(2, { year: 1931 })]);
    expect(sparse[0].rows.map((r) => r.year)).toEqual([1909, 1931, 1958]);
  });

  it("orders columns with '' first, then ordinal ascending", () => {
    const [lincoln] = buildAlbumLayout([L3, L4, L1, L5, L2]);
    expect(lincoln.columns.map((c) => c.mintMark)).toEqual(['', 'D', 'S']);

    const mixed = buildAlbumLayout([
      slot(0, { year: 1900, mintMark: 'S' }),
      slot(1, { year: 1900, mintMark: 'CC' }),
      slot(2, { year: 1900, mintMark: '' }),
      slot(3, { year: 1900, mintMark: 'D' }),
    ]);
    expect(mixed[0].columns.map((c) => c.mintMark)).toEqual(['', 'CC', 'D', 'S']);
  });

  it("an all-'' page has exactly one column", () => {
    const [ukraine] = buildAlbumLayout([U1, U2]);
    expect(ukraine.columns.map((c) => c.mintMark)).toEqual(['']);
    expect(ukraine.rows).toHaveLength(1);
    expect(ukraine.rows[0].cells).toHaveLength(1);
  });

  it('puts several varieties of one year and mint mark in the same cell, in position order', () => {
    const [lincoln] = buildAlbumLayout([L2, L1, L3, L4, L5]);
    const row1909 = lincoln.rows.find((r) => r.year === 1909)!;
    const cell = row1909.cells[0];

    expect(cell.year).toBe(1909);
    expect(cell.mintMark).toBe('');
    expect(cell.slots.map((s) => s.id)).toEqual([L1.id, L2.id]);
  });

  it('gives every row one cell per column, aligned by index, with empty slots for blank cells', () => {
    const [lincoln] = buildAlbumLayout([L1, L2, L3, L4, L5]);

    for (const row of lincoln.rows) {
      expect(row.cells).toHaveLength(lincoln.columns.length);
      row.cells.forEach((cell, i) => {
        expect(cell.mintMark).toBe(lincoln.columns[i].mintMark);
        expect(cell.year).toBe(row.year);
      });
    }
    const r1909 = lincoln.rows[0];
    const r1910 = lincoln.rows[1];
    // columns: '', D, S
    expect(r1909.cells.map((c) => c.slots.length)).toEqual([2, 0, 1]); // 1909 D blank
    expect(r1910.cells.map((c) => c.slots.length)).toEqual([1, 1, 0]); // 1910 S blank
  });

  it('counts per page and per column, ignoring blank cells', () => {
    const [lincoln, ukraine] = buildAlbumLayout([L1, L2, L3, L4, L5, U1, U2]);

    expect(lincoln.ownedCount).toBe(3);
    expect(lincoln.totalCount).toBe(5);
    expect(lincoln.columns).toEqual([
      { mintMark: '', ownedCount: 2, totalCount: 3 },
      { mintMark: 'D', ownedCount: 0, totalCount: 1 },
      { mintMark: 'S', ownedCount: 1, totalCount: 1 },
    ]);
    expect(ukraine.ownedCount).toBe(1);
    expect(ukraine.totalCount).toBe(2);
    expect(ukraine.columns).toEqual([{ mintMark: '', ownedCount: 1, totalCount: 2 }]);
  });

  it('changes counts when ownership changes (different inputs give different outputs)', () => {
    const allMissing = [L1, L2, L3, L4, L5].map((s) => ({ ...s, owned: false }));
    const allOwned = [L1, L2, L3, L4, L5].map((s) => ({ ...s, owned: true }));

    expect(buildAlbumLayout(allMissing)[0].ownedCount).toBe(0);
    expect(buildAlbumLayout(allOwned)[0].ownedCount).toBe(5);
    expect(buildAlbumLayout(allOwned)[0].columns.map((c) => c.ownedCount)).toEqual([3, 1, 1]);
  });

  it('is stable: equal positions keep input order, and the same input gives the same output', () => {
    const a = slot(3, { id: 'tieA', year: 1920 });
    const b = slot(3, { id: 'tieB', year: 1920 });
    const c = slot(3, { id: 'tieC', year: 1920 });

    const first = buildAlbumLayout([b, c, a]);
    const second = buildAlbumLayout([b, c, a]);

    expect(first[0].rows[0].cells[0].slots.map((s) => s.id)).toEqual([b.id, c.id, a.id]);
    expect(second).toEqual(first);
    const swapped = buildAlbumLayout([a, b, c]);
    expect(swapped[0].rows[0].cells[0].slots.map((s) => s.id)).toEqual([a.id, b.id, c.id]);
  });

  it('does not mutate the input array or its order', () => {
    const input = [L5, L3, L1, L4, L2];
    const before = input.map((s) => s.id);
    const snapshot = JSON.stringify(input);

    buildAlbumLayout(input);

    expect(input.map((s) => s.id)).toEqual(before);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('exposes the page key as country|denomination|name', () => {
    const [lincoln] = buildAlbumLayout([L1]);
    expect(lincoln.key).toBe('USA|Cent|Lincoln Wheat Cent');
  });
});

describe('formatAlbumCoinName', () => {
  it('joins year, mint mark, variety and name, skipping empty parts', () => {
    expect(formatAlbumCoinName({ year: 1931, mintMark: 'S', variety: '', name: 'Lincoln Wheat Cent' })).toBe(
      '1931 S Lincoln Wheat Cent',
    );
    expect(formatAlbumCoinName({ year: 1909, mintMark: '', variety: 'VDB', name: 'Lincoln Wheat Cent' })).toBe(
      '1909 VDB Lincoln Wheat Cent',
    );
    expect(formatAlbumCoinName({ year: 1909, mintMark: 'S', variety: 'VDB', name: 'Lincoln Wheat Cent' })).toBe(
      '1909 S VDB Lincoln Wheat Cent',
    );
    expect(formatAlbumCoinName({ year: 1922, mintMark: '', variety: 'No D', name: 'Lincoln Wheat Cent' })).toBe(
      '1922 No D Lincoln Wheat Cent',
    );
  });
});

describe('formatAlbumSlotLabel', () => {
  const words = { owned: 'owned', missing: 'missing', keyDate: 'key date' };
  const base = slot(0, { year: 1931, mintMark: 'S' });

  it('formats a missing key-date coin', () => {
    const s = { ...base, owned: false, coin: { ...base.coin, isKeyDate: true } };
    expect(formatAlbumSlotLabel(s, words)).toBe('1931 S Lincoln Wheat Cent, missing, key date');
  });

  it('formats an owned non-key coin without the key-date part', () => {
    const s = { ...base, owned: true, coin: { ...base.coin, isKeyDate: false } };
    expect(formatAlbumSlotLabel(s, words)).toBe('1931 S Lincoln Wheat Cent, owned');
  });

  it('uses the translated words it is given', () => {
    const es = { owned: 'en posesión', missing: 'faltante', keyDate: 'fecha clave' };
    const s = { ...base, owned: false, coin: { ...base.coin, isKeyDate: true } };
    expect(formatAlbumSlotLabel(s, es)).toBe('1931 S Lincoln Wheat Cent, faltante, fecha clave');
  });
});

describe('formatOwnedOfTotal', () => {
  it('replaces {owned} and {total}', () => {
    expect(formatOwnedOfTotal('{owned} of {total} owned', 3, 5)).toBe('3 of 5 owned');
    expect(formatOwnedOfTotal('{owned} of {total} owned', 0, 12)).toBe('0 of 12 owned');
  });

  it('works with a translated template', () => {
    expect(formatOwnedOfTotal('{owned} de {total} en posesión', 2, 7)).toBe('2 de 7 en posesión');
  });
});
