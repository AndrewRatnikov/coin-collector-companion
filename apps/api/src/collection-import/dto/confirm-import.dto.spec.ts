/**
 * Tests for: ConfirmImportDto
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (DTOs)
 * Covers criteria: #6 (ids validated), #9 (confirm at most IMPORT_MAX_ROWS ids) (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator decorators; fixtures use real UUID v4 values.
 */

import { IMPORT_MAX_ROWS } from '@coin-collector/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmImportDto } from './confirm-import.dto';
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
