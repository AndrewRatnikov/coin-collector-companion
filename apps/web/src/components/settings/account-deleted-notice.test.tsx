/**
 * Tests for: AccountDeletedNotice
 * Contract source: runs/run_20261001_214421/plan.md § Interface Contract → Component: AccountDeletedNotice
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountDeletedNotice } from '@/components/settings/account-deleted-notice';

describe('AccountDeletedNotice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing when the flag is not set', async () => {
    render(<AccountDeletedNotice />);

    // Let effects flush.
    await Promise.resolve();
    expect(screen.queryByTestId('account-deleted-notice')).not.toBeInTheDocument();
  });

  it('shows the notice when the flag is set and removes the flag', async () => {
    sessionStorage.setItem('ccc-account-deleted', '1');

    render(<AccountDeletedNotice />);

    const notice = await screen.findByTestId('account-deleted-notice');
    expect(notice).toHaveTextContent('Your account has been deleted.');
    expect(notice).toHaveAttribute('role', 'status');
    expect(sessionStorage.getItem('ccc-account-deleted')).toBeNull();
  });

  it('shows nothing on a second fresh mount', async () => {
    sessionStorage.setItem('ccc-account-deleted', '1');
    const first = render(<AccountDeletedNotice />);
    await screen.findByTestId('account-deleted-notice');
    first.unmount();

    render(<AccountDeletedNotice />);
    await Promise.resolve();

    expect(screen.queryByTestId('account-deleted-notice')).not.toBeInTheDocument();
  });
});
