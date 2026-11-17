/**
 * Tests for: isNotFoundError
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Function: isNotFoundError
 * Covers criteria: #6
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { isNotFoundError } from '@/lib/not-found-error';

describe('isNotFoundError', () => {
  it.each([404, 400])('is true for an ApiError with status %i', (status) => {
    expect(isNotFoundError(new ApiError(status, 'x'))).toBe(true);
  });

  it.each([401, 403, 500, 409, 502])('is false for an ApiError with status %i', (status) => {
    expect(isNotFoundError(new ApiError(status, 'x'))).toBe(false);
  });

  it('is false for a plain Error, even one that mentions 404', () => {
    expect(isNotFoundError(new Error('x'))).toBe(false);
    expect(isNotFoundError(new Error('404 Not Found'))).toBe(false);
  });

  it('is false for a plain object that merely has status 404', () => {
    expect(isNotFoundError({ status: 404 })).toBe(false);
  });

  it('is false for undefined and null', () => {
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
