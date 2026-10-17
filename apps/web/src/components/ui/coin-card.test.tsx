/**
 * Tests for: CoinCard
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: CoinCard
 * Covers criteria: #8, #16 (from prd.md): owned, missing, pending, failed, key date, selected, visitor
 *
 * The pending status text waits 150ms (useDelayedPending), so that block uses fake timers.
 *
 * CONTRACT_GAPS: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { CatalogCoin } from '@coin-collector/shared';
import { CoinCard, type CoinCardProps } from '@/components/ui/coin-card';

const BASE: CatalogCoin = {
  id: 'coin-donetsk',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  mintMark: '',
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: 'Brass-plated steel',
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const KEY_COIN: CatalogCoin = {
  ...BASE,
  id: 'coin-vdb',
  country: 'United States',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  name: 'Lincoln Wheat Cent',
  material: 'Bronze',
  isKeyDate: true,
};

const PLAIN_COIN: CatalogCoin = {
  ...BASE,
  id: 'coin-25k',
  country: 'Ukraine',
  denomination: '25 Kopiyok',
  year: 1992,
  variety: '',
  name: 'Ukraine 25 Kopiyok',
  material: null,
};

function renderCard(over: Partial<CoinCardProps> = {}) {
  const onToggle = vi.fn();
  const onSelect = vi.fn();
  const utils = render(<CoinCard coin={BASE} owned={false} onToggle={onToggle} onSelect={onSelect} {...over} />);
  return { onToggle, onSelect, ...utils };
}

describe('CoinCard: content', () => {
  it('shows the getCoinName eyebrow, title and subtitle', () => {
    renderCard();

    expect(screen.getByTestId('coin-card-eyebrow')).toHaveTextContent(/^We Are Strong\. We Are Together$/);
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^Donetsk Oblast$/);
    expect(screen.getByTestId('coin-card-subtitle')).toHaveTextContent(/^Ukraine · 10 Hryvnias · 2025$/);
  });

  it('shows a different coin\'s own parts (not constants)', () => {
    renderCard({ coin: KEY_COIN });

    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^1909-S VDB$/);
    expect(screen.getByTestId('coin-card-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    expect(screen.getByTestId('coin-card-subtitle')).toHaveTextContent(/^United States · 1 Cent$/);
  });

  it('omits the eyebrow element when the coin has none', () => {
    renderCard({ coin: PLAIN_COIN });

    expect(screen.queryByTestId('coin-card-eyebrow')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^25 Kopiyok$/);
    expect(screen.getByTestId('coin-card-subtitle')).toHaveTextContent(/^Ukraine · 1992$/);
  });

  it('hides the eyebrow when hideEyebrow is set', () => {
    renderCard({ hideEyebrow: true });

    expect(screen.queryByTestId('coin-card-eyebrow')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent('Donetsk Oblast');
  });

  it('puts the title inside a stretched link to the coin page', () => {
    renderCard();
    const link = screen.getByTestId('coin-card-link');

    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/catalog/coin-donetsk');
    expect(within(link).getByTestId('coin-card-title')).toBeInTheDocument();
    expect(link.className).toContain('after:absolute');
    expect(link.className).toContain('after:inset-0');
  });

  it('links each coin to its own id', () => {
    renderCard({ coin: KEY_COIN });
    expect(screen.getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/coin-vdb');
  });

  it('exposes the coin id on the root', () => {
    renderCard();
    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-coin-id', 'coin-donetsk');
  });
});

describe('CoinCard: coin well', () => {
  it('renders a fluid placeholder coin sized from the container, toned by the material', () => {
    renderCard();
    const well = screen.getByTestId('coin-card-well');
    const coin = within(well).getByTestId('placeholder-coin');

    expect(coin).toHaveAttribute('data-size', 'fluid');
    expect(coin).toHaveAttribute('data-tone', 'gold');
    expect(well.className).toContain('@container');
    expect(within(well).getByTestId('placeholder-coin-numeral')).toHaveTextContent('10');
  });

  it('shows the photo instead of the numeral when the coin has an image', () => {
    renderCard({ coin: { ...BASE, imageUrl: 'https://example.com/donetsk.jpg' } });
    const well = screen.getByTestId('coin-card-well');

    expect(within(well).getByTestId('placeholder-coin-image')).toHaveAttribute('src', 'https://example.com/donetsk.jpg');
    expect(within(well).queryByTestId('placeholder-coin-numeral')).not.toBeInTheDocument();
  });

  it('fades the coin when it is missing and the viewer is the owner', () => {
    renderCard({ owned: false });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-missing', 'true');
  });

  it('does not fade an owned coin', () => {
    renderCard({ owned: true });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-missing', 'false');
  });

  it('does not fade the coin for a visitor, even though it is not owned', () => {
    renderCard({ owned: false, visitor: true });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-missing', 'false');
  });

  it('puts a key-date badge in the well of a key-date coin only', () => {
    const { unmount } = renderCard({ coin: KEY_COIN });
    const badge = within(screen.getByTestId('coin-card-well')).getByTestId('badge');
    expect(badge).toHaveAttribute('data-variant', 'key-date');
    expect(badge).toHaveTextContent('★ Key date');
    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-key-date', 'true');
    unmount();

    renderCard({ coin: BASE });
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card')).not.toHaveAttribute('data-key-date', 'true');
  });
});

describe('CoinCard: states', () => {
  it('owned: tinted card, owned data-state, "In collection", check is pressed', () => {
    renderCard({ owned: true });
    const card = screen.getByTestId('coin-card');

    expect(card).toHaveAttribute('data-state', 'owned');
    expect(card).toHaveAttribute('data-status', 'idle');
    expect(card.className).toContain('bg-accent-100');
    expect(card.className).toContain('border-accent-400');
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^In collection$/);
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('missing: neutral card, missing data-state, "Missing", check is not pressed', () => {
    renderCard({ owned: false });
    const card = screen.getByTestId('coin-card');

    expect(card).toHaveAttribute('data-state', 'missing');
    expect(card.className).toContain('bg-neutral-100');
    expect(card.className).not.toContain('bg-accent-100');
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Missing$/);
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('failed: danger border, alert "Couldn’t save" and a Retry button that calls onToggle', () => {
    const { onToggle } = renderCard({ owned: false, status: 'failed' });
    const card = screen.getByTestId('coin-card');

    expect(card).toHaveAttribute('data-status', 'failed');
    expect(card.className).toContain('border-danger');
    const status = screen.getByTestId('coin-card-status');
    expect(status).toHaveTextContent('Couldn’t save');
    expect(within(card).getByRole('alert')).toHaveTextContent('Couldn’t save');

    const retry = screen.getByTestId('coin-card-retry');
    expect(retry).toHaveTextContent('Retry');
    fireEvent.click(retry);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('failed wins over owned in the status text', () => {
    renderCard({ owned: true, status: 'failed' });
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent('Couldn’t save');
    expect(screen.getByTestId('coin-card-status')).not.toHaveTextContent('In collection');
  });

  it('shows no Retry button and no danger border unless the card failed', () => {
    renderCard({ owned: true, status: 'idle' });
    expect(screen.queryByTestId('coin-card-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card').className).not.toContain('border-danger');
  });

  it('passes the pending and failed status down to the check', () => {
    const { rerender, onToggle } = renderCard({ status: 'pending' });
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('status-toggle')).toBeDisabled();
    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-status', 'pending');

    rerender(<CoinCard coin={BASE} owned={false} status="failed" onToggle={onToggle} />);
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('data-state', 'failed');
  });

  it('selected: outlined card and data-selected', () => {
    const { unmount } = renderCard({ selectMode: true, selected: true });
    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('coin-card').className).toContain('outline-accent-700');
    unmount();

    renderCard({ selectMode: true, selected: false });
    expect(screen.getByTestId('coin-card')).not.toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('coin-card').className).not.toContain('outline-accent-700');
  });

  it('visitor: neutral card, visitor data-state, no status line, no check', () => {
    renderCard({ owned: true, visitor: true });
    const card = screen.getByTestId('coin-card');

    expect(card).toHaveAttribute('data-state', 'visitor');
    expect(card.className).toContain('bg-neutral-100');
    expect(card.className).not.toContain('bg-accent-100');
    expect(screen.queryByTestId('coin-card-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-link')).toBeInTheDocument();
  });
});

describe('CoinCard: the check', () => {
  it('is named for the coin title and toggles ownership without being part of the link', () => {
    const { onToggle } = renderCard({ owned: false });
    const toggle = screen.getByTestId('status-toggle');

    expect(toggle).toHaveAttribute('aria-label', 'Mark Donetsk Oblast as owned');
    expect(screen.getByTestId('coin-card-link').contains(toggle)).toBe(false);
    expect(toggle.className).toContain('absolute');
    expect(toggle.className).toContain('z-[3]');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('flips its name with ownership and follows the coin title', () => {
    renderCard({ owned: true, coin: KEY_COIN });
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-label', 'Mark 1909-S VDB as missing');
  });

  it('renders the check as the check variant', () => {
    renderCard();
    expect(screen.getByTestId('status-toggle')).toHaveAttribute('data-variant', 'check');
  });
});

describe('CoinCard: select mode', () => {
  it('replaces the link and the check with a full-card select button', () => {
    renderCard({ selectMode: true });

    expect(screen.queryByTestId('coin-card-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    const select = screen.getByTestId('coin-card-select');
    expect(select.tagName).toBe('BUTTON');
    expect(select.className).toContain('absolute');
    expect(select.className).toContain('inset-0');
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent('Donetsk Oblast');
  });

  it('reflects the selection in aria-pressed and names the coin', () => {
    const { unmount } = renderCard({ selectMode: true, selected: false });
    expect(screen.getByTestId('coin-card-select')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('coin-card-select')).toHaveAttribute('aria-label', 'Select Donetsk Oblast');
    unmount();

    renderCard({ selectMode: true, selected: true, coin: KEY_COIN });
    expect(screen.getByTestId('coin-card-select')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('coin-card-select')).toHaveAttribute('aria-label', 'Select 1909-S VDB');
  });

  it('calls onSelect on click', () => {
    const { onSelect, onToggle } = renderCard({ selectMode: true });
    fireEvent.click(screen.getByTestId('coin-card-select'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('has no select button outside select mode', () => {
    renderCard();
    expect(screen.queryByTestId('coin-card-select')).not.toBeInTheDocument();
  });
});

describe('CoinCard: pending status text', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the normal status for the first 149ms and shows "Saving…" from 150ms', () => {
    renderCard({ owned: false, status: 'pending' });
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Missing$/);

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Missing$/);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Saving…$/);
  });

  it('never shows "Saving…" when the save finishes inside the delay', () => {
    const { rerender, onToggle } = renderCard({ owned: false, status: 'pending' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<CoinCard coin={BASE} owned status="idle" onToggle={onToggle} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^In collection$/);
  });
});
