import { chunk, planCoinImport } from '../../../scripts/import-catalog/lib/plan';
import type { DesiredCoinRow, ExistingCoinRow } from '../../../scripts/import-catalog/lib/plan';

// CONTRACT_GAPs: none

function desiredRow(overrides: Partial<DesiredCoinRow> = {}): DesiredCoinRow {
  return {
    country: 'US',
    denomination: 'Cent',
    year: 1909,
    mintMark: '',
    variety: '',
    name: 'Lincoln Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: 19,
    weightG: 3.11,
    thicknessMm: 1.55,
    material: 'Bronze',
    mintage: 72702618,
    isKeyDate: false,
    ...overrides,
  };
}

function existingRow(overrides: Partial<ExistingCoinRow> = {}): ExistingCoinRow {
  return { id: 'coin-1', ...desiredRow(), ...overrides };
}

describe('planCoinImport', () => {
  it('creates a desired row that has no existing match', () => {
    const d = desiredRow();
    const plan = planCoinImport([d], []);
    expect(plan.toCreate).toEqual([d]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it('updates only name when only the name changed', () => {
    const plan = planCoinImport([desiredRow({ name: 'New Name' })], [existingRow({ name: 'Old Name' })]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].id).toBe('coin-1');
    expect(plan.toUpdate[0].data).toEqual({ name: 'New Name' });
    expect(plan.toUpdate[0].key).toEqual({
      country: 'US',
      denomination: 'Cent',
      year: 1909,
      mintMark: '',
      variety: '',
    });
  });

  it('updates an image field when it changed', () => {
    const plan = planCoinImport(
      [desiredRow({ imageUrl: 'https://example.org/a.jpg', imageSource: 'Commons', imageLicense: 'PD' })],
      [existingRow({ imageUrl: null, imageSource: null, imageLicense: 'PD' })],
    );
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].data).toEqual({ imageUrl: 'https://example.org/a.jpg', imageSource: 'Commons' });
  });

  it('updates a spec field changed from value to a different value', () => {
    const plan = planCoinImport([desiredRow({ weightG: 3.5 })], [existingRow({ weightG: 3.11 })]);
    expect(plan.toUpdate[0].data).toEqual({ weightG: 3.5 });
  });

  it('sets null (not undefined) when a spec value goes to null', () => {
    const plan = planCoinImport([desiredRow({ diameterMm: null })], [existingRow({ diameterMm: 19 })]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].data).toEqual({ diameterMm: null });
    expect(Object.prototype.hasOwnProperty.call(plan.toUpdate[0].data, 'diameterMm')).toBe(true);
    expect(plan.toUpdate[0].data.diameterMm).toBeNull();
  });

  it('updates a spec field changed from null to a value', () => {
    const plan = planCoinImport([desiredRow({ mintage: 500 })], [existingRow({ mintage: null })]);
    expect(plan.toUpdate[0].data).toEqual({ mintage: 500 });
  });

  it('updates isKeyDate and material when they differ', () => {
    const plan = planCoinImport(
      [desiredRow({ isKeyDate: true, material: 'Copper' })],
      [existingRow({ isKeyDate: false, material: 'Bronze' })],
    );
    expect(plan.toUpdate[0].data).toEqual({ isKeyDate: true, material: 'Copper' });
  });

  it('reports an identical row as unchanged and writes nothing (re-run)', () => {
    const e = existingRow();
    const plan = planCoinImport([desiredRow()], [e]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([e]);
  });

  it('re-run over many identical rows plans no writes', () => {
    const desired = [1909, 1910, 1911].map((year) => desiredRow({ year }));
    const existing = [1909, 1910, 1911].map((year) => existingRow({ id: `id-${year}`, year }));
    const plan = planCoinImport(desired, existing);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(3);
  });

  it('treats an undefined existing field as equal to a desired null', () => {
    const e = existingRow();
    delete e.imageUrl;
    delete e.thicknessMm;
    const plan = planCoinImport([desiredRow({ imageUrl: null, thicknessMm: null })], [e]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toHaveLength(1);
  });

  it('collapses duplicate keys: last values win, one entry, first position', () => {
    const plan = planCoinImport(
      [
        desiredRow({ year: 1909, name: 'First' }),
        desiredRow({ year: 1910, name: 'Other' }),
        desiredRow({ year: 1909, name: 'Last' }),
      ],
      [],
    );
    expect(plan.toCreate.map((r) => [r.year, r.name])).toEqual([
      [1909, 'Last'],
      [1910, 'Other'],
    ]);
  });

  it('collapses duplicate keys against an existing row: updates once with the last values', () => {
    const plan = planCoinImport(
      [desiredRow({ name: 'First' }), desiredRow({ name: 'Last' })],
      [existingRow({ name: 'Old' })],
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].data).toEqual({ name: 'Last' });
  });

  it('ignores existing rows that are absent from desired', () => {
    const plan = planCoinImport(
      [desiredRow({ year: 1909 })],
      [existingRow({ id: 'a', year: 1909 }), existingRow({ id: 'b', year: 1955, name: 'Doubled Die' })],
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged.map((r) => r.id)).toEqual(['a']);
  });

  it('returns empty arrays for empty desired, even with existing rows', () => {
    const plan = planCoinImport([], [existingRow()]);
    expect(plan).toEqual({ toCreate: [], toUpdate: [], unchanged: [] });
  });

  it('needs all five key fields to match', () => {
    const e = existingRow();
    const variants: Partial<DesiredCoinRow>[] = [
      { mintMark: 'S' },
      { variety: 'VDB' },
      { year: 1910 },
      { denomination: 'Dime' },
      { country: 'CA' },
    ];
    for (const v of variants) {
      const plan = planCoinImport([desiredRow(v)], [e]);
      expect(plan.toCreate).toHaveLength(1);
      expect(plan.toUpdate).toEqual([]);
      expect(plan.unchanged).toEqual([]);
    }
  });

  it('matches keys case-sensitively', () => {
    const plan = planCoinImport([desiredRow({ mintMark: 's' })], [existingRow({ mintMark: 'S' })]);
    expect(plan.toCreate).toHaveLength(1);
  });

  it('splits a mixed batch into create, update and unchanged in first-occurrence order', () => {
    const desired = [
      desiredRow({ year: 1911 }),
      desiredRow({ year: 1909, name: 'Renamed' }),
      desiredRow({ year: 1910 }),
      desiredRow({ year: 1912 }),
    ];
    const existing = [existingRow({ id: 'id-1909', year: 1909 }), existingRow({ id: 'id-1910', year: 1910 })];
    const plan = planCoinImport(desired, existing);
    expect(plan.toCreate.map((r) => r.year)).toEqual([1911, 1912]);
    expect(plan.toUpdate.map((u) => u.id)).toEqual(['id-1909']);
    expect(plan.unchanged.map((r) => r.id)).toEqual(['id-1910']);
  });

  it('does not mutate its inputs and returns only the 15 write columns for creates', () => {
    const desired = [desiredRow({ name: 'A' }), desiredRow({ name: 'B' })];
    const existing = [existingRow({ name: 'Old' })];
    const desiredCopy = structuredClone(desired);
    const existingCopy = structuredClone(existing);
    const plan = planCoinImport(desired, existing);
    expect(desired).toEqual(desiredCopy);
    expect(existing).toEqual(existingCopy);

    const created = planCoinImport([desiredRow({ year: 2000 })], [])
      .toCreate[0];
    expect(Object.keys(created).sort()).toEqual(
      [
        'country',
        'denomination',
        'year',
        'mintMark',
        'variety',
        'name',
        'imageUrl',
        'imageSource',
        'imageLicense',
        'diameterMm',
        'weightG',
        'thicknessMm',
        'material',
        'mintage',
        'isKeyDate',
      ].sort(),
    );
    expect(plan.toUpdate[0].data).toEqual({ name: 'B' });
  });
});

describe('chunk', () => {
  it('splits into consecutive chunks of at most size, preserving order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2, 3, 4, 5], 5)).toEqual([[1, 2, 3, 4, 5]]);
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('throws RangeError when size is not a positive integer', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], -1)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
    expect(() => chunk([1], Number.NaN)).toThrow(RangeError);
  });
});
