/**
 * Tests for: set-deleted-notice helpers
 * Contract source: runs/run_20261011_095624/plan.md § Interface Contract → Module: set-deleted-notice
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SET_DELETED_NOTICE_KEY, consumeSetDeletedNotice, markSetDeleted } from '@/lib/set-deleted-notice';

describe('set-deleted-notice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('exposes the sessionStorage key', () => {
    expect(SET_DELETED_NOTICE_KEY).toBe('ccc-set-deleted');
  });

  it('markSetDeleted stores the set name under the key', () => {
    markSetDeleted('My Wheat Cents');
    expect(sessionStorage.getItem('ccc-set-deleted')).toBe('My Wheat Cents');

    markSetDeleted('Key Dates');
    expect(sessionStorage.getItem('ccc-set-deleted')).toBe('Key Dates');
  });

  it('consumeSetDeletedNotice returns null when nothing was marked', () => {
    expect(consumeSetDeletedNotice()).toBeNull();
  });

  it('consumeSetDeletedNotice returns the name once, removes the key, then null', () => {
    markSetDeleted('My Wheat Cents');

    expect(consumeSetDeletedNotice()).toBe('My Wheat Cents');
    expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
    expect(consumeSetDeletedNotice()).toBeNull();
  });

  it('returns the name that was stored, not a fixed value', () => {
    markSetDeleted('Another Set');
    expect(consumeSetDeletedNotice()).toBe('Another Set');
  });

  it('returns null for an empty stored value but still removes the key', () => {
    sessionStorage.setItem('ccc-set-deleted', '');

    expect(consumeSetDeletedNotice()).toBeNull();
    expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
  });
});
