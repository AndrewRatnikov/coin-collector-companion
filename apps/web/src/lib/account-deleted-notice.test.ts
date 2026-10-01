/**
 * Tests for: account-deleted-notice helpers
 * Contract source: runs/run_20261001_214421/plan.md § Interface Contract → Module: account-deleted-notice helpers
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETED_NOTICE_KEY,
  consumeAccountDeletedNotice,
  markAccountDeleted,
} from '@/lib/account-deleted-notice';

describe('account-deleted-notice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('exposes the sessionStorage key', () => {
    expect(ACCOUNT_DELETED_NOTICE_KEY).toBe('ccc-account-deleted');
  });

  it('markAccountDeleted sets the key to "1"', () => {
    markAccountDeleted();
    expect(sessionStorage.getItem('ccc-account-deleted')).toBe('1');
  });

  it('consumeAccountDeletedNotice returns false when the flag was never set', () => {
    expect(consumeAccountDeletedNotice()).toBe(false);
  });

  it('consumeAccountDeletedNotice returns true once, removes the key, then false', () => {
    markAccountDeleted();

    expect(consumeAccountDeletedNotice()).toBe(true);
    expect(sessionStorage.getItem('ccc-account-deleted')).toBeNull();
    expect(consumeAccountDeletedNotice()).toBe(false);
  });
});
