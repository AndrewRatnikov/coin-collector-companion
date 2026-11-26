import { APPROVED_STATUS, chunk, planCoinImport } from '../../../scripts/import-catalog/lib/plan';
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
  return { id: 'coin-1', status: 'approved', ...desiredRow(), ...overrides };
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
    expect(plan).toEqual({ toCreate: [], toUpdate: [], unchanged: [], conflicts: [] });
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
    expect(plan.conflicts).toEqual([]);
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

describe('planCoinImport conflicts (non-approved rows on a fixture key)', () => {
  const key = (year: number) => ({
    country: 'US',
    denomination: 'Cent',
    year,
    mintMark: '',
    variety: '',
  });

  it('exports the approved status constant', () => {
    expect(APPROVED_STATUS).toBe('approved');
  });

  it('reports a pending row as a conflict and never creates or updates it', () => {
    const plan = planCoinImport(
      [desiredRow({ name: 'Official' })],
      [existingRow({ id: 'sub-1', status: 'pending', name: 'User Name' })],
    );
    expect(plan.conflicts).toEqual([{ key: key(1909), id: 'sub-1', status: 'pending' }]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.unchanged).toEqual([]);
  });

  it('reports a rejected row as a conflict, carrying its own id and status', () => {
    const plan = planCoinImport(
      [desiredRow({ year: 1910 })],
      [existingRow({ id: 'sub-2', status: 'rejected', year: 1910 })],
    );
    expect(plan.conflicts).toEqual([{ key: key(1910), id: 'sub-2', status: 'rejected' }]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it('is a conflict even when the pending row is identical to the fixture', () => {
    const plan = planCoinImport([desiredRow()], [existingRow({ status: 'pending' })]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.unchanged).toEqual([]);
  });

  it('treats any status that is not exactly "approved" as a conflict', () => {
    for (const status of ['Approved', 'APPROVED', '', 'archived']) {
      const plan = planCoinImport([desiredRow()], [existingRow({ status })]);
      expect(plan.conflicts).toHaveLength(1);
      expect(plan.conflicts[0].status).toBe(status);
      expect(plan.toUpdate).toEqual([]);
      expect(plan.unchanged).toEqual([]);
    }
  });

  it('treats a missing status as a conflict', () => {
    const e = existingRow({ id: 'no-status' });
    delete (e as { status?: string }).status;
    const plan = planCoinImport([desiredRow({ name: 'Official' })], [e]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].id).toBe('no-status');
    expect(plan.conflicts[0].key).toEqual(key(1909));
    expect(plan.conflicts[0].status).toBeUndefined();
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toCreate).toEqual([]);
  });

  it('still updates and keeps unchanged for approved rows', () => {
    const approvedChanged = planCoinImport(
      [desiredRow({ name: 'New' })],
      [existingRow({ status: 'approved', name: 'Old' })],
    );
    expect(approvedChanged.conflicts).toEqual([]);
    expect(approvedChanged.toUpdate).toHaveLength(1);

    const approvedSame = planCoinImport([desiredRow()], [existingRow({ status: 'approved' })]);
    expect(approvedSame.conflicts).toEqual([]);
    expect(approvedSame.unchanged).toHaveLength(1);
  });

  it('ignores a non-approved row whose key no desired row has', () => {
    const plan = planCoinImport(
      [desiredRow({ year: 1909 })],
      [existingRow({ id: 'ok', year: 1909 }), existingRow({ id: 'other', year: 1955, status: 'pending' })],
    );
    expect(plan.conflicts).toEqual([]);
    expect(plan.unchanged.map((r) => r.id)).toEqual(['ok']);
  });

  it('splits a mixed batch, with conflicts in first-occurrence order', () => {
    const desired = [
      desiredRow({ year: 1913 }),
      desiredRow({ year: 1911 }),
      desiredRow({ year: 1909, name: 'Renamed' }),
      desiredRow({ year: 1910 }),
      desiredRow({ year: 1912 }),
    ];
    const existing = [
      existingRow({ id: 'id-1909', year: 1909 }),
      existingRow({ id: 'id-1910', year: 1910 }),
      existingRow({ id: 'id-1911', year: 1911, status: 'rejected' }),
      existingRow({ id: 'id-1913', year: 1913, status: 'pending' }),
    ];
    const plan = planCoinImport(desired, existing);
    expect(plan.conflicts.map((c) => [c.id, c.status])).toEqual([
      ['id-1913', 'pending'],
      ['id-1911', 'rejected'],
    ]);
    expect(plan.toCreate.map((r) => r.year)).toEqual([1912]);
    expect(plan.toUpdate.map((u) => u.id)).toEqual(['id-1909']);
    expect(plan.unchanged.map((r) => r.id)).toEqual(['id-1910']);
  });

  it('reports a duplicated desired key as one conflict', () => {
    const plan = planCoinImport(
      [desiredRow({ name: 'First' }), desiredRow({ name: 'Last' })],
      [existingRow({ status: 'pending' })],
    );
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.toUpdate).toEqual([]);
  });

  it('a re-run with the same conflicts reports them again and writes nothing new', () => {
    const desired = [desiredRow({ year: 1909 }), desiredRow({ year: 1910 })];
    const existing = [
      existingRow({ id: 'a', year: 1909, status: 'pending' }),
      existingRow({ id: 'b', year: 1910 }),
    ];
    const first = planCoinImport(desired, existing);
    const second = planCoinImport(desired, existing);
    expect(second.conflicts).toEqual(first.conflicts);
    expect(second.conflicts).toHaveLength(1);
    expect(second.toCreate).toEqual([]);
    expect(second.toUpdate).toEqual([]);
    expect(second.unchanged.map((r) => r.id)).toEqual(['b']);
  });

  it('does not mutate its inputs when there are conflicts', () => {
    const desired = [desiredRow({ name: 'Official' })];
    const existing = [existingRow({ status: 'pending', name: 'User' })];
    const desiredCopy = structuredClone(desired);
    const existingCopy = structuredClone(existing);
    planCoinImport(desired, existing);
    expect(desired).toEqual(desiredCopy);
    expect(existing).toEqual(existingCopy);
  });

  it('returns the plan keys in the documented order', () => {
    expect(Object.keys(planCoinImport([], []))).toEqual(['toCreate', 'toUpdate', 'unchanged', 'conflicts']);
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
