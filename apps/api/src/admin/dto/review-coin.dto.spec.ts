/**
 * Tests for: ReviewCoinDto
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → DTO: ReviewCoinDto (CREATE)
 * Covers criteria: #8, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators (plainToInstance + validate),
 * same convention as create-coin.dto.spec.ts. The "reason with approved is invalid" rule lives in
 * AdminService.reviewCoin, not here (see admin.service.spec.ts).
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { REJECTION_REASON_MAX_LENGTH, ReviewCoinDto } from './review-coin.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(ReviewCoinDto, body);
  return { instance, errors: await validate(instance) };
}

const CURRENT_YEAR = new Date().getFullYear();

describe('ReviewCoinDto', () => {
  describe('status (criterion #8)', () => {
    it('accepts "approved"', async () => {
      const { errors } = await validateBody({ status: 'approved' });
      expect(errors).toHaveLength(0);
    });

    it('accepts "rejected"', async () => {
      const { errors } = await validateBody({ status: 'rejected' });
      expect(errors).toHaveLength(0);
    });

    it('rejects "pending" (a decision cannot set a coin back to pending)', async () => {
      const { errors } = await validateBody({ status: 'pending' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('rejects an unknown status value', async () => {
      const { errors } = await validateBody({ status: 'maybe' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when status is missing', async () => {
      const { errors } = await validateBody({});
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  describe('rejectionReason (criterion #8)', () => {
    it('exports a maximum length of 500', () => {
      expect(REJECTION_REASON_MAX_LENGTH).toBe(500);
    });

    it('is optional', async () => {
      const { instance, errors } = await validateBody({ status: 'rejected' });
      expect(errors).toHaveLength(0);
      expect(instance.rejectionReason).toBeUndefined();
    });

    it('trims surrounding whitespace', async () => {
      const { instance, errors } = await validateBody({ status: 'rejected', rejectionReason: '  blurry photo  ' });
      expect(errors).toHaveLength(0);
      expect(instance.rejectionReason).toBe('blurry photo');
    });

    it('accepts a reason of exactly the maximum length', async () => {
      const { errors } = await validateBody({
        status: 'rejected',
        rejectionReason: 'x'.repeat(REJECTION_REASON_MAX_LENGTH),
      });
      expect(errors.filter((e) => e.property === 'rejectionReason')).toHaveLength(0);
    });

    it('rejects a reason one character over the maximum length', async () => {
      const { errors } = await validateBody({
        status: 'rejected',
        rejectionReason: 'x'.repeat(REJECTION_REASON_MAX_LENGTH + 1),
      });
      expect(errors.some((e) => e.property === 'rejectionReason')).toBe(true);
    });

    it('rejects a non-string reason', async () => {
      const { errors } = await validateBody({ status: 'rejected', rejectionReason: 42 });
      expect(errors.some((e) => e.property === 'rejectionReason')).toBe(true);
    });
  });

  describe('edit fields (criterion #9)', () => {
    it('are all optional: a status-only body leaves every edit field undefined (no "= \'\'" defaults)', async () => {
      const { instance, errors } = await validateBody({ status: 'approved' });
      expect(errors).toHaveLength(0);
      expect(instance.country).toBeUndefined();
      expect(instance.denomination).toBeUndefined();
      expect(instance.name).toBeUndefined();
      expect(instance.year).toBeUndefined();
      expect(instance.mintMark).toBeUndefined();
      expect(instance.variety).toBeUndefined();
    });

    it('trims country/denomination/name', async () => {
      const { instance, errors } = await validateBody({
        status: 'approved',
        country: '  USA  ',
        denomination: '  1 Cent  ',
        name: '  Indian Head Cent  ',
      });
      expect(errors).toHaveLength(0);
      expect(instance.country).toBe('USA');
      expect(instance.denomination).toBe('1 Cent');
      expect(instance.name).toBe('Indian Head Cent');
    });

    it('rejects non-string country/denomination/name', async () => {
      const { errors } = await validateBody({ status: 'approved', country: 5, denomination: 6, name: 7 });
      expect(errors.some((e) => e.property === 'country')).toBe(true);
      expect(errors.some((e) => e.property === 'denomination')).toBe(true);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('normalizes mintMark through sanitizeIdentityField: "None" collapses to an empty string', async () => {
      const { instance, errors } = await validateBody({ status: 'approved', mintMark: 'None' });
      expect(errors).toHaveLength(0);
      expect(instance.mintMark).toBe('');
    });

    it('normalizes variety through sanitizeIdentityField: "n/a" collapses to an empty string', async () => {
      const { instance, errors } = await validateBody({ status: 'approved', variety: 'n/a' });
      expect(errors).toHaveLength(0);
      expect(instance.variety).toBe('');
    });

    it('trims and preserves a real mintMark ("  D  " -> "D")', async () => {
      const { instance } = await validateBody({ status: 'approved', mintMark: '  D  ' });
      expect(instance.mintMark).toBe('D');
    });

    it('rejects a year below 1000', async () => {
      const { errors } = await validateBody({ status: 'approved', year: 999 });
      expect(errors.some((e) => e.property === 'year')).toBe(true);
    });

    it('rejects a year more than one year in the future', async () => {
      const { errors } = await validateBody({ status: 'approved', year: CURRENT_YEAR + 2 });
      expect(errors.some((e) => e.property === 'year')).toBe(true);
    });

    it('accepts a year of exactly current year + 1 (inclusive upper bound)', async () => {
      const { errors } = await validateBody({ status: 'approved', year: CURRENT_YEAR + 1 });
      expect(errors.filter((e) => e.property === 'year')).toHaveLength(0);
    });

    it('rejects a non-integer year', async () => {
      const { errors } = await validateBody({ status: 'approved', year: 1900.5 });
      expect(errors.some((e) => e.property === 'year')).toBe(true);
    });

    it('coerces a numeric-string year to a number', async () => {
      const { instance, errors } = await validateBody({ status: 'approved', year: '1943' });
      expect(errors).toHaveLength(0);
      expect(instance.year).toBe(1943);
    });
  });
});
