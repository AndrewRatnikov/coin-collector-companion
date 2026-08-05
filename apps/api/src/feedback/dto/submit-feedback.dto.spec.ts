/**
 * Tests for: SubmitFeedbackDto
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Backend DTO:
 *                   apps/api/src/feedback/dto/submit-feedback.dto.ts (CREATE)
 * Covers criteria: #6, #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Exercises the real class-validator/class-transformer decorators declared on
 * SubmitFeedbackDto (no mocking possible or needed — a pure validation/transform class),
 * following the same plainToInstance + validate() convention as
 * apps/api/src/catalog/dto/create-coin.dto.spec.ts.
 */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitFeedbackDto } from './submit-feedback.dto';

async function validateBody(body: unknown) {
  const instance = plainToInstance(SubmitFeedbackDto, body);
  return { instance, errors: await validate(instance) };
}

describe('SubmitFeedbackDto (criteria #6, #8)', () => {
  it('passes with a normal, non-empty text value', async () => {
    const { errors } = await validateBody({ text: 'I love the gap-view feature!' });
    expect(errors).toHaveLength(0);
  });

  it('trims leading/trailing whitespace from text', async () => {
    const { instance } = await validateBody({ text: '  Great app!  ' });
    expect(instance.text).toBe('Great app!');
  });

  it('fails when text is missing entirely', async () => {
    const { errors } = await validateBody({});
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('fails when text is an empty string', async () => {
    const { errors } = await validateBody({ text: '' });
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('fails when text is whitespace-only (empty after trim)', async () => {
    const { errors } = await validateBody({ text: '     ' });
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('passes when text is exactly 2000 characters (inclusive upper bound)', async () => {
    const { errors } = await validateBody({ text: 'a'.repeat(2000) });
    expect(errors.filter((e) => e.property === 'text')).toHaveLength(0);
  });

  it('fails when text is 2001 characters (over the max length)', async () => {
    const { errors } = await validateBody({ text: 'a'.repeat(2001) });
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });

  it('fails when text is not a string', async () => {
    const { errors } = await validateBody({ text: 12345 });
    expect(errors.some((e) => e.property === 'text')).toBe(true);
  });
});
