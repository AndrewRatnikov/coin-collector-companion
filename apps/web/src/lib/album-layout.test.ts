/**
 * Tests for: album-layout (pure layout + formatters)
 * Contract source: runs/run_20261010_083926/plan.md § Interface Contract → Module: album-layout
 * Covers criteria: existing #3, #4, #5 (all-'' page), #6, #7, #8, #10, #17, #18, #19 (buildAlbumLayout and
 *                  formatters, preserved), and new #1, #2, #3, #5, #6, #7, #9, #15, #20, #23, #24
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { GapSlot } from '@coin-collector/shared';
import {
  buildAlbumLayout,
  formatAlbumCardLabel,
  formatAlbumCheckLabel,
  formatAlbumCoinName,
  formatAlbumCoinShortName,
  formatAlbumPageHeading,
  formatAlbumSlotLabel,
  formatCollectorNotation,
  formatOwnedOfTotal,
  getAlbumCardText,
  getDenominationNumeral,
  getSharedEyebrow,
  hasBlankCells,
  isNoMintMarkPage,
  splitVariety,
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

// ---------------------------------------------------------------------------
// New: coin-card naming helpers, tested with real seed data
// ---------------------------------------------------------------------------

const WAS_SERIES = 'We Are Strong. We Are Together';
const WAS_OBLASTS = [
  'Donetsk Oblast',
  'Luhansk Oblast',
  'Kharkiv Oblast',
  'Kherson Oblast',
  'Zaporizhzhia Oblast',
  'Mykolaiv Oblast',
  'Kyiv Oblast',
  'Sumy Oblast',
  'Chernihiv Oblast',
  'Odesa Oblast',
  'Zhytomyr Oblast',
  'Dnipropetrovsk Oblast',
];

function wasSlots(year = 2025): GapSlot[] {
  return WAS_OBLASTS.map((oblast, i) =>
    slot(i, {
      id: `was-${year}-${i}`,
      year,
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      name: 'Ukraine Commemorative 10 Hryvnias',
      variety: `${WAS_SERIES}: ${oblast}`,
    }),
  );
}

describe('splitVariety', () => {
  it('splits at the first ": " into eyebrow and title', () => {
    expect(splitVariety('We Are Strong. We Are Together: Donetsk Oblast')).toEqual({
      eyebrow: 'We Are Strong. We Are Together',
      title: 'Donetsk Oblast',
    });
  });

  it('splits only at the FIRST ": " and keeps later ones in the title', () => {
    expect(splitVariety('Series: Subject: Detail')).toEqual({ eyebrow: 'Series', title: 'Subject: Detail' });
  });

  it('returns the whole variety as the title when there is no ": "', () => {
    expect(splitVariety('VDB')).toEqual({ eyebrow: '', title: 'VDB' });
    expect(splitVariety('Brass-plated steel')).toEqual({ eyebrow: '', title: 'Brass-plated steel' });
    expect(splitVariety('Antonivskyi Bridge')).toEqual({ eyebrow: '', title: 'Antonivskyi Bridge' });
    expect(splitVariety('No D')).toEqual({ eyebrow: '', title: 'No D' });
  });

  it('does not split on a colon without a following space', () => {
    expect(splitVariety('Ratio 1:2')).toEqual({ eyebrow: '', title: 'Ratio 1:2' });
  });

  it('trims both sides', () => {
    expect(splitVariety('  Series  :   Subject  ')).toEqual({ eyebrow: 'Series', title: 'Subject' });
    expect(splitVariety('Series:  Subject ')).toEqual({ eyebrow: 'Series', title: 'Subject' });
    expect(splitVariety('  Plain  ')).toEqual({ eyebrow: '', title: 'Plain' });
  });

  it('returns the non-empty side when one side is empty', () => {
    expect(splitVariety('Foo: ')).toEqual({ eyebrow: '', title: 'Foo' });
    expect(splitVariety(': Foo')).toEqual({ eyebrow: '', title: 'Foo' });
  });

  it("returns empty eyebrow and title for ''", () => {
    expect(splitVariety('')).toEqual({ eyebrow: '', title: '' });
  });
});

describe('formatCollectorNotation', () => {
  it("is just the year when the mint mark is ''", () => {
    expect(formatCollectorNotation({ year: 1909, mintMark: '' })).toBe('1909');
    expect(formatCollectorNotation({ year: 2014, mintMark: '' })).toBe('2014');
  });

  it('is year-mintMark otherwise', () => {
    expect(formatCollectorNotation({ year: 1931, mintMark: 'S' })).toBe('1931-S');
    expect(formatCollectorNotation({ year: 1909, mintMark: 'D' })).toBe('1909-D');
  });
});

describe('getAlbumCardText', () => {
  it('Donetsk (WAS 2025): eyebrow is the series, title the oblast, secondary has year and denomination', () => {
    expect(
      getAlbumCardText({
        year: 2025,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        denomination: '10 Hryvnias',
      }),
    ).toEqual({
      eyebrow: 'We Are Strong. We Are Together',
      title: 'Donetsk Oblast',
      secondary: '2025 · 10 Hryvnias',
    });
  });

  it('a different WAS oblast and year change title and secondary', () => {
    expect(
      getAlbumCardText({
        year: 2026,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Luhansk Oblast',
        denomination: '10 Hryvnias',
      }),
    ).toEqual({
      eyebrow: 'We Are Strong. We Are Together',
      title: 'Luhansk Oblast',
      secondary: '2026 · 10 Hryvnias',
    });
  });

  it("1931-S with no variety: title is the collector notation, secondary is just the denomination", () => {
    expect(getAlbumCardText({ year: 1931, mintMark: 'S', variety: '', denomination: 'Cent' })).toEqual({
      eyebrow: '',
      title: '1931-S',
      secondary: 'Cent',
    });
  });

  it('plain 1909 Cent: title 1909, secondary Cent', () => {
    expect(getAlbumCardText({ year: 1909, mintMark: '', variety: '', denomination: 'Cent' })).toEqual({
      eyebrow: '',
      title: '1909',
      secondary: 'Cent',
    });
  });

  it('1909 VDB: variety is the title, secondary prefixes the year', () => {
    expect(getAlbumCardText({ year: 1909, mintMark: '', variety: 'VDB', denomination: 'Cent' })).toEqual({
      eyebrow: '',
      title: 'VDB',
      secondary: '1909 · Cent',
    });
  });

  it('1909-S VDB uses the collector notation in the secondary line', () => {
    expect(getAlbumCardText({ year: 1909, mintMark: 'S', variety: 'VDB', denomination: 'Cent' }).secondary).toBe(
      '1909-S · Cent',
    );
  });

  it('1922 No D', () => {
    expect(getAlbumCardText({ year: 1922, mintMark: '', variety: 'No D', denomination: 'Cent' })).toEqual({
      eyebrow: '',
      title: 'No D',
      secondary: '1922 · Cent',
    });
  });

  it('1955 Doubled Die', () => {
    expect(getAlbumCardText({ year: 1955, mintMark: '', variety: 'Doubled Die', denomination: 'Cent' })).toEqual({
      eyebrow: '',
      title: 'Doubled Die',
      secondary: '1955 · Cent',
    });
  });

  it('plain Ukrainian 2014 1 Kopiyka', () => {
    expect(getAlbumCardText({ year: 2014, mintMark: '', variety: '', denomination: '1 Kopiyka' })).toEqual({
      eyebrow: '',
      title: '2014',
      secondary: '1 Kopiyka',
    });
  });

  it('2014 Brass-plated steel 10 Kopiyok', () => {
    expect(
      getAlbumCardText({ year: 2014, mintMark: '', variety: 'Brass-plated steel', denomination: '10 Kopiyok' }),
    ).toEqual({ eyebrow: '', title: 'Brass-plated steel', secondary: '2014 · 10 Kopiyok' });
  });

  it('Antonivskyi Bridge (2023) shows the full subject as the title with no eyebrow', () => {
    const text = getAlbumCardText({
      year: 2023,
      mintMark: '',
      variety: 'Antonivskyi Bridge',
      denomination: '10 Hryvnias',
    });
    expect(text.eyebrow).toBe('');
    expect(text.title).toBe('Antonivskyi Bridge');
    expect(text.secondary).toBe('2023 · 10 Hryvnias');
  });

  it('does not repeat the year when the title already contains it (UEFA Euro 2012)', () => {
    expect(
      getAlbumCardText({
        year: 2012,
        mintMark: '',
        variety: 'UEFA Euro 2012 Final Tournament',
        denomination: '1 Hryvnia',
      }),
    ).toEqual({ eyebrow: '', title: 'UEFA Euro 2012 Final Tournament', secondary: '1 Hryvnia' });
  });

  it('does not mutate its input', () => {
    const coin = { year: 1909, mintMark: 'S', variety: 'VDB', denomination: 'Cent' };
    const snapshot = JSON.stringify(coin);
    getAlbumCardText(coin);
    expect(JSON.stringify(coin)).toBe(snapshot);
  });
});

describe('getDenominationNumeral', () => {
  it('takes the leading number', () => {
    expect(getDenominationNumeral('10 Hryvnias')).toBe('10');
    expect(getDenominationNumeral('1 Kopiyka')).toBe('1');
    expect(getDenominationNumeral('50 Kopiyok')).toBe('50');
  });

  it('falls back to the first number anywhere in the string', () => {
    expect(getDenominationNumeral('Half 5 Cents')).toBe('5');
  });

  it("falls back to '1' when there is no number (Cent)", () => {
    expect(getDenominationNumeral('Cent')).toBe('1');
  });
});

describe('getSharedEyebrow', () => {
  it('returns the series name when all 12 WAS coins share it', () => {
    const [page] = buildAlbumLayout(wasSlots());
    expect(getSharedEyebrow(page)).toBe(WAS_SERIES);
  });

  it('also works across several years of the same series', () => {
    const [page] = buildAlbumLayout([...wasSlots(2025), ...wasSlots(2026)]);
    expect(getSharedEyebrow(page)).toBe(WAS_SERIES);
  });

  it("returns '' when only one coin is on the page", () => {
    const [page] = buildAlbumLayout(wasSlots().slice(0, 1));
    expect(getSharedEyebrow(page)).toBe('');
  });

  it('returns the eyebrow with exactly two coins (boundary)', () => {
    const [page] = buildAlbumLayout(wasSlots().slice(0, 2));
    expect(getSharedEyebrow(page)).toBe(WAS_SERIES);
  });

  it("returns '' when one coin has no eyebrow", () => {
    const mixed = [
      ...wasSlots().slice(0, 3),
      slot(50, {
        id: 'antonivskyi',
        year: 2023,
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        name: 'Ukraine Commemorative 10 Hryvnias',
        variety: 'Antonivskyi Bridge',
      }),
    ];
    const [page] = buildAlbumLayout(mixed);
    expect(getSharedEyebrow(page)).toBe('');
  });

  it("returns '' when eyebrows differ", () => {
    const a = slot(0, {
      id: 'ea',
      year: 2025,
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      name: 'Same',
      variety: 'Series A: One',
    });
    const b = slot(1, {
      id: 'eb',
      year: 2025,
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      name: 'Same',
      variety: 'Series B: Two',
    });
    const [page] = buildAlbumLayout([a, b]);
    expect(getSharedEyebrow(page)).toBe('');
  });

  it("returns '' for plain coins without a variety", () => {
    const [page] = buildAlbumLayout([L1, L5]);
    expect(getSharedEyebrow(page)).toBe('');
  });
});

describe('isNoMintMarkPage', () => {
  it("is true when every column is ''", () => {
    const [ukraine] = buildAlbumLayout([U1, U2]);
    expect(isNoMintMarkPage(ukraine)).toBe(true);
  });

  it('is false when any coin has a mint mark', () => {
    const [lincoln] = buildAlbumLayout([L1, L2, L3, L4, L5]);
    expect(isNoMintMarkPage(lincoln)).toBe(false);
  });
});

describe('hasBlankCells', () => {
  it('is true for the Lincoln page with blank year/mint-mark cells', () => {
    const [lincoln] = buildAlbumLayout([L1, L2, L3, L4, L5]);
    expect(hasBlankCells(lincoln)).toBe(true);
  });

  it('is false for a full single-column page', () => {
    const [ukraine] = buildAlbumLayout([U1, U2]);
    expect(hasBlankCells(ukraine)).toBe(false);
  });

  it('is false when every year x mint-mark cell has a coin', () => {
    const full = buildAlbumLayout([
      slot(0, { year: 1909 }),
      slot(1, { year: 1909, mintMark: 'S' }),
      slot(2, { year: 1910 }),
      slot(3, { year: 1910, mintMark: 'S' }),
    ]);
    expect(hasBlankCells(full[0])).toBe(false);
  });
});

describe('formatAlbumPageHeading', () => {
  it('keeps the name alone when it already contains the country', () => {
    expect(formatAlbumPageHeading({ name: 'Ukraine 10 Hryvnias', country: 'Ukraine' })).toBe('Ukraine 10 Hryvnias');
    expect(formatAlbumPageHeading({ name: 'Ukraine Commemorative 10 Hryvnias', country: 'Ukraine' })).toBe(
      'Ukraine Commemorative 10 Hryvnias',
    );
  });

  it('matches the country case-insensitively', () => {
    expect(formatAlbumPageHeading({ name: 'UKRAINE coins', country: 'Ukraine' })).toBe('UKRAINE coins');
  });

  it('appends " · country" when the name lacks it', () => {
    expect(formatAlbumPageHeading({ name: 'Lincoln Wheat Cent', country: 'USA' })).toBe('Lincoln Wheat Cent · USA');
    expect(formatAlbumPageHeading({ name: 'Commemorative', country: 'Ukraine' })).toBe('Commemorative · Ukraine');
  });
});

describe('formatAlbumCoinShortName', () => {
  it('adds the collector notation when the title lacks the year', () => {
    expect(formatAlbumCoinShortName({ year: 2025, mintMark: '', variety: `${WAS_SERIES}: Donetsk Oblast` })).toBe(
      'Donetsk Oblast 2025',
    );
    expect(formatAlbumCoinShortName({ year: 1909, mintMark: '', variety: 'VDB' })).toBe('VDB 1909');
    expect(formatAlbumCoinShortName({ year: 1909, mintMark: 'S', variety: 'VDB' })).toBe('VDB 1909-S');
  });

  it('is just the title when it already contains the year', () => {
    expect(formatAlbumCoinShortName({ year: 1931, mintMark: 'S', variety: '' })).toBe('1931-S');
    expect(formatAlbumCoinShortName({ year: 2012, mintMark: '', variety: 'UEFA Euro 2012 Final Tournament' })).toBe(
      'UEFA Euro 2012 Final Tournament',
    );
  });
});

describe('formatAlbumCheckLabel', () => {
  const donetsk = { year: 2025, mintMark: '', variety: `${WAS_SERIES}: Donetsk Oblast` };

  it('fills {coin} in the template', () => {
    expect(formatAlbumCheckLabel('Mark {coin} as owned', donetsk)).toBe('Mark Donetsk Oblast 2025 as owned');
    expect(formatAlbumCheckLabel('Mark {coin} as missing', { year: 1931, mintMark: 'S', variety: '' })).toBe(
      'Mark 1931-S as missing',
    );
  });

  it('replaces every {coin} occurrence', () => {
    expect(formatAlbumCheckLabel('{coin} / {coin}', { year: 1909, mintMark: '', variety: 'VDB' })).toBe(
      'VDB 1909 / VDB 1909',
    );
  });

  it('works with a translated template', () => {
    expect(formatAlbumCheckLabel('Marcar {coin} como faltante', { year: 1909, mintMark: 'S', variety: 'VDB' })).toBe(
      'Marcar VDB 1909-S como faltante',
    );
  });
});

describe('formatAlbumCardLabel', () => {
  const words = { owned: 'owned', missing: 'missing', keyDate: 'key date' };
  const cardSlot = (
    coin: { year: number; mintMark: string; variety: string; denomination: string; isKeyDate?: boolean },
    owned: boolean,
  ) => ({ coin: { isKeyDate: false, ...coin }, owned });

  it('includes the eyebrow, title, notation, denomination and status for a WAS coin', () => {
    const s = cardSlot(
      { year: 2025, mintMark: '', variety: `${WAS_SERIES}: Donetsk Oblast`, denomination: '10 Hryvnias' },
      false,
    );
    expect(formatAlbumCardLabel(s, words)).toBe(
      'We Are Strong. We Are Together: Donetsk Oblast, 2025, 10 Hryvnias, missing',
    );
  });

  it('1931-S key date: notation is not repeated, key date is appended', () => {
    const s = cardSlot({ year: 1931, mintMark: 'S', variety: '', denomination: 'Cent', isKeyDate: true }, false);
    expect(formatAlbumCardLabel(s, words)).toBe('1931-S, Cent, missing, key date');
  });

  it('owned VDB reads "VDB, 1909, Cent, owned"', () => {
    const s = cardSlot({ year: 1909, mintMark: '', variety: 'VDB', denomination: 'Cent' }, true);
    expect(formatAlbumCardLabel(s, words)).toBe('VDB, 1909, Cent, owned');
  });

  it('uses the translated words', () => {
    const es = { owned: 'en posesión', missing: 'faltante', keyDate: 'fecha clave' };
    const s = cardSlot({ year: 1931, mintMark: 'S', variety: '', denomination: 'Cent', isKeyDate: true }, true);
    expect(formatAlbumCardLabel(s, es)).toBe('1931-S, Cent, en posesión, fecha clave');
  });
});
