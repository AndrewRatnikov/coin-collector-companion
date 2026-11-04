/**
 * Tests for: ConfirmImportDto, ImportConfirmGradeDto
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (DTOs)
 *                   and runs/run_20261104_064643/plan.md § Approach 6
 * Covers criteria: #6 (ids validated), #9 (confirm at most IMPORT_MAX_ROWS ids) (from run_20261005_212015 prd.md);
 *                  #11 (grades validated against COIN_GRADES) (from run_20261104_064643 prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators; fixtures use real UUID v4 values.
 */

import { COIN_GRADES, IMPORT_MAX_ROWS } from '@coin-collector/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmImportDto, ImportConfirmGradeDto } from './confirm-import.dto';
import { PreviewImportDto } from './preview-import.dto';

const UUID_A = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

async function validateConfirm(body: unknown) {
  return validate(plainToInstance(ConfirmImportDto, body));
}

function uuidV4(i: number): string {
  const hex = i.toString(16).padStart(12, '0');
  return `3fa85f64-5717-4562-b3fc-${hex}`;
}

describe('ConfirmImportDto', () => {
  it('passes with one or several UUID v4 ids', async () => {
    expect(await validateConfirm({ coinIds: [UUID_A] })).toHaveLength(0);
    expect(await validateConfirm({ coinIds: [UUID_A, UUID_B] })).toHaveLength(0);
  });

  it('fails when coinIds is missing', async () => {
    const errors = await validateConfirm({});
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails when coinIds is not an array', async () => {
    expect((await validateConfirm({ coinIds: UUID_A })).some((e) => e.property === 'coinIds')).toBe(true);
    expect((await validateConfirm({ coinIds: { 0: UUID_A } })).some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails for an empty array', async () => {
    const errors = await validateConfirm({ coinIds: [] });
    expect(errors.some((e) => e.property === 'coinIds')).toBe(true);
  });

  it('fails when any element is not a UUID v4', async () => {
    expect((await validateConfirm({ coinIds: [UUID_A, 'not-a-uuid'] })).some((e) => e.property === 'coinIds')).toBe(true);
    expect((await validateConfirm({ coinIds: [123] })).some((e) => e.property === 'coinIds')).toBe(true);
    // v1 UUID is not accepted
    expect(
      (await validateConfirm({ coinIds: ['c232ab00-9414-11ec-b3c8-9f6bdeced846'] })).some((e) => e.property === 'coinIds'),
    ).toBe(true);
  });

  it(`passes with exactly ${IMPORT_MAX_ROWS} ids and fails with ${IMPORT_MAX_ROWS + 1}`, async () => {
    const atLimit = Array.from({ length: IMPORT_MAX_ROWS }, (_, i) => uuidV4(i));
    const overLimit = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => uuidV4(i));
    expect(await validateConfirm({ coinIds: atLimit })).toHaveLength(0);
    expect((await validateConfirm({ coinIds: overLimit })).some((e) => e.property === 'coinIds')).toBe(true);
  });

  describe('grades', () => {
    it('passes without grades (backward compatible) and with an empty grades array', async () => {
      expect(await validateConfirm({ coinIds: [UUID_A] })).toHaveLength(0);
      expect(await validateConfirm({ coinIds: [UUID_A], grades: [] })).toHaveLength(0);
    });

    it('passes with valid grade entries', async () => {
      expect(
        await validateConfirm({
          coinIds: [UUID_A, UUID_B],
          grades: [
            { coinId: UUID_A, grade: 'VF' },
            { coinId: UUID_B, grade: 'UNC' },
          ],
        }),
      ).toHaveLength(0);
    });

    it.each(COIN_GRADES.map((g) => [g]))('accepts the grade %s', async (grade) => {
      expect(await validateConfirm({ coinIds: [UUID_A], grades: [{ coinId: UUID_A, grade }] })).toHaveLength(0);
    });

    it('produces ImportConfirmGradeDto instances for the nested entries', () => {
      const dto = plainToInstance(ConfirmImportDto, {
        coinIds: [UUID_A],
        grades: [{ coinId: UUID_A, grade: 'F' }],
      });
      expect(dto.grades?.[0]).toBeInstanceOf(ImportConfirmGradeDto);
    });

    it.each([
      ['a Spanish abbreviation', 'MBC'],
      ['a lower-case grade', 'vf'],
      ['an unknown grade', 'MS-65'],
      ['an empty string', ''],
      ['null', null],
      ['a number', 4],
    ])('rejects %s as a grade', async (_label, grade) => {
      const errors = await validateConfirm({ coinIds: [UUID_A], grades: [{ coinId: UUID_A, grade }] });
      expect(errors.some((e) => e.property === 'grades')).toBe(true);
    });

    it('rejects a missing grade', async () => {
      const errors = await validateConfirm({ coinIds: [UUID_A], grades: [{ coinId: UUID_A }] });
      expect(errors.some((e) => e.property === 'grades')).toBe(true);
    });

    it('rejects a coinId that is not a UUID v4', async () => {
      const bad = await validateConfirm({ coinIds: [UUID_A], grades: [{ coinId: 'not-a-uuid', grade: 'F' }] });
      expect(bad.some((e) => e.property === 'grades')).toBe(true);
      const v1 = await validateConfirm({
        coinIds: [UUID_A],
        grades: [{ coinId: 'c232ab00-9414-11ec-b3c8-9f6bdeced846', grade: 'F' }],
      });
      expect(v1.some((e) => e.property === 'grades')).toBe(true);
    });

    it('rejects a missing coinId', async () => {
      const errors = await validateConfirm({ coinIds: [UUID_A], grades: [{ grade: 'F' }] });
      expect(errors.some((e) => e.property === 'grades')).toBe(true);
    });

    it('fails the whole array when only one entry is invalid', async () => {
      const errors = await validateConfirm({
        coinIds: [UUID_A, UUID_B],
        grades: [
          { coinId: UUID_A, grade: 'F' },
          { coinId: UUID_B, grade: 'nope' },
        ],
      });
      expect(errors.some((e) => e.property === 'grades')).toBe(true);
    });

    it('rejects grades that is not an array', async () => {
      expect(
        (await validateConfirm({ coinIds: [UUID_A], grades: { coinId: UUID_A, grade: 'F' } })).some(
          (e) => e.property === 'grades',
        ),
      ).toBe(true);
      expect((await validateConfirm({ coinIds: [UUID_A], grades: 'F' })).some((e) => e.property === 'grades')).toBe(
        true,
      );
    });

    it(`passes with exactly ${IMPORT_MAX_ROWS} grade entries and fails with ${IMPORT_MAX_ROWS + 1}`, async () => {
      const ids = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => uuidV4(i));
      const entries = ids.map((coinId) => ({ coinId, grade: 'G' }));
      expect(
        await validateConfirm({ coinIds: ids.slice(0, IMPORT_MAX_ROWS), grades: entries.slice(0, IMPORT_MAX_ROWS) }),
      ).toHaveLength(0);
      const over = await validateConfirm({ coinIds: ids.slice(0, IMPORT_MAX_ROWS), grades: entries });
      expect(over.some((e) => e.property === 'grades')).toBe(true);
    });
  });
});

describe('ImportConfirmGradeDto', () => {
  it('validates a good entry and rejects a bad grade', async () => {
    expect(await validate(plainToInstance(ImportConfirmGradeDto, { coinId: UUID_A, grade: 'AU' }))).toHaveLength(0);
    const errors = await validate(plainToInstance(ImportConfirmGradeDto, { coinId: UUID_A, grade: 'EBC+' }));
    expect(errors.some((e) => e.property === 'grade')).toBe(true);
  });

  it('reports coinId errors on the coinId property', async () => {
    const errors = await validate(plainToInstance(ImportConfirmGradeDto, { coinId: 'x', grade: 'AU' }));
    expect(errors.some((e) => e.property === 'coinId')).toBe(true);
  });
});

describe('PreviewImportDto', () => {
  it('passes with no mapping and with a short string mapping', async () => {
    expect(await validate(plainToInstance(PreviewImportDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(PreviewImportDto, { mapping: '{"year":0}' }))).toHaveLength(0);
  });

  it('fails when mapping is not a string', async () => {
    const errors = await validate(plainToInstance(PreviewImportDto, { mapping: { year: 0 } }));
    expect(errors.some((e) => e.property === 'mapping')).toBe(true);
  });

  it('fails when mapping is longer than 2000 characters and passes at exactly 2000', async () => {
    const tooLong = await validate(plainToInstance(PreviewImportDto, { mapping: 'x'.repeat(2001) }));
    expect(tooLong.some((e) => e.property === 'mapping')).toBe(true);
    const atLimit = await validate(plainToInstance(PreviewImportDto, { mapping: 'x'.repeat(2000) }));
    expect(atLimit).toHaveLength(0);
  });
});
