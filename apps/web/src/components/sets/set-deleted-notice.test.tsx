/**
 * Tests for: SetDeletedNotice
 * Contract source: runs/run_20261011_095624/plan.md § Interface Contract → Component: SetDeletedNotice
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetDeletedNotice } from '@/components/sets/set-deleted-notice';

describe('SetDeletedNotice', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing when the flag is not set', async () => {
    render(<SetDeletedNotice />);

    // Let effects flush.
    await Promise.resolve();
    expect(screen.queryByTestId('set-deleted-notice')).not.toBeInTheDocument();
  });

  it('shows a status notice naming the deleted set and removes the flag', async () => {
    sessionStorage.setItem('ccc-set-deleted', 'My Wheat Cents');

    render(<SetDeletedNotice />);

    const notice = await screen.findByTestId('set-deleted-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice.textContent).toBe(
      '“My Wheat Cents” was deleted. The coins you own from it are still in your collection.',
    );
    expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
  });

  it('uses the stored name, not a fixed one', async () => {
    sessionStorage.setItem('ccc-set-deleted', 'Key Dates');

    render(<SetDeletedNotice />);

    const notice = await screen.findByTestId('set-deleted-notice');
    expect(notice).toHaveTextContent('“Key Dates” was deleted.');
    expect(notice).not.toHaveTextContent('My Wheat Cents');
  });

  it('shows nothing on a second fresh mount', async () => {
    sessionStorage.setItem('ccc-set-deleted', 'My Wheat Cents');
    const first = render(<SetDeletedNotice />);
    await screen.findByTestId('set-deleted-notice');
    first.unmount();

    render(<SetDeletedNotice />);
    await Promise.resolve();

    expect(screen.queryByTestId('set-deleted-notice')).not.toBeInTheDocument();
  });
});
