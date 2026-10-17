/**
 * Tests for: SetCard
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: SetCard
 * Covers criteria: #3 (mono numerals), #11, #16 (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SetCard, type SetCardProps } from '@/components/ui/set-card';

function renderCard(over: Partial<SetCardProps> = {}) {
  return render(
    <SetCard
      href="/sets/set-1"
      name="We Are Strong. We Are Together"
      ownedCount={11}
      totalCount={12}
      nextMissingTitle="Zaporizhzhia Oblast"
      {...over}
    />,
  );
}

describe('SetCard: in progress', () => {
  it('links the set name to its page', () => {
    renderCard();
    const link = screen.getByTestId('set-card-link');

    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/sets/set-1');
    expect(link).toHaveTextContent('We Are Strong. We Are Together');
  });

  it('shows "N of M owned" and the rounded percentage', () => {
    renderCard();

    expect(screen.getByTestId('set-card-owned')).toHaveTextContent(/^11 of 12 owned$/);
    expect(screen.getByTestId('set-card-percent')).toHaveTextContent(/^92%$/);
  });

  it('derives the numbers from the props (a different set gives different numbers)', () => {
    renderCard({ ownedCount: 1, totalCount: 3, nextMissingTitle: null });

    expect(screen.getByTestId('set-card-owned')).toHaveTextContent(/^1 of 3 owned$/);
    expect(screen.getByTestId('set-card-percent')).toHaveTextContent(/^33%$/);
  });

  it('rounds half up like the API (2 of 3 is 67%)', () => {
    renderCard({ ownedCount: 2, totalCount: 3 });
    expect(screen.getByTestId('set-card-percent')).toHaveTextContent(/^67%$/);
  });

  it('renders the progress bar with value, bounds, label and fill width', () => {
    renderCard();
    const bar = screen.getByTestId('set-card-progress');

    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '92');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', '92% complete');
    const fill = bar.querySelector<HTMLElement>('[style*="width"]');
    expect(fill).not.toBeNull();
    expect(fill?.style.width).toBe('92%');
  });

  it('moves the progress bar with the numbers', () => {
    renderCard({ ownedCount: 1, totalCount: 4 });
    const bar = screen.getByTestId('set-card-progress');

    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-label', '25% complete');
    expect(bar.querySelector<HTMLElement>('[style*="width"]')?.style.width).toBe('25%');
  });

  it('uses the plain accent fill while incomplete', () => {
    renderCard();
    const fill = screen.getByTestId('set-card-progress').querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.className).toContain('bg-accent');
    expect(fill?.className).not.toContain('bg-accent-700');
  });

  it('is not marked complete', () => {
    renderCard();
    expect(screen.getByTestId('set-card')).toHaveAttribute('data-complete', 'false');
  });

  it('shows the next missing coin when one is given', () => {
    renderCard();

    expect(screen.getByTestId('set-card-next')).toHaveTextContent(/^Next: Zaporizhzhia Oblast$/);
    expect(screen.queryByTestId('set-card-to-find')).not.toBeInTheDocument();
  });

  it('names a different next coin when it changes', () => {
    renderCard({ nextMissingTitle: 'Odesa Oblast' });
    expect(screen.getByTestId('set-card-next')).toHaveTextContent(/^Next: Odesa Oblast$/);
  });

  it('shows "{n} to find" when no next coin is given, for both null and undefined', () => {
    const { unmount } = renderCard({ nextMissingTitle: null });
    expect(screen.getByTestId('set-card-to-find')).toHaveTextContent(/^1 to find$/);
    expect(screen.queryByTestId('set-card-next')).not.toBeInTheDocument();
    unmount();

    renderCard({ nextMissingTitle: undefined, ownedCount: 9, totalCount: 12 });
    expect(screen.getByTestId('set-card-to-find')).toHaveTextContent(/^3 to find$/);
  });

  it('shows a missing badge with the number of missing coins', () => {
    renderCard({ ownedCount: 9, totalCount: 12 });
    const badge = screen.getByTestId('badge');

    expect(badge).toHaveAttribute('data-variant', 'missing');
    expect(badge).toHaveTextContent(/^3 missing$/);
  });

  it('shows the source line only when a source is given', () => {
    const { unmount } = renderCard({ source: 'Curated checklist' });
    expect(screen.getByTestId('set-card-source')).toHaveTextContent('Curated checklist');
    unmount();

    renderCard();
    expect(screen.queryByTestId('set-card-source')).not.toBeInTheDocument();
  });

  it('renders the counts and the percentage in tabular mono with lining numerals', () => {
    renderCard();
    const bolds = screen.getByTestId('set-card-owned').querySelectorAll('b');

    expect(bolds).toHaveLength(2);
    bolds.forEach((b) => {
      expect(b.className).toContain('font-mono');
      expect(b.className).toContain('lining-nums');
      expect(b.className).toContain('tabular-nums');
    });
    const percent = screen.getByTestId('set-card-percent');
    expect(percent.className).toContain('font-mono');
    expect(percent.className).toContain('lining-nums');
    expect(percent.className).toContain('tabular-nums');
  });

  it('is not a loading placeholder', () => {
    renderCard();
    expect(screen.queryByTestId('set-card-skeleton')).not.toBeInTheDocument();
  });
});

describe('SetCard: complete', () => {
  it('is marked complete, with the full bar, "Every coin found" and a complete badge', () => {
    renderCard({ ownedCount: 12, totalCount: 12, nextMissingTitle: null });

    expect(screen.getByTestId('set-card')).toHaveAttribute('data-complete', 'true');
    expect(screen.getByTestId('set-card-percent')).toHaveTextContent(/^100%$/);
    expect(screen.getByTestId('set-card-owned')).toHaveTextContent(/^12 of 12 owned$/);
    expect(screen.getByTestId('set-card-every-found')).toHaveTextContent('Every coin found');
    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'complete');
    expect(screen.getByTestId('badge')).toHaveTextContent('✓ Complete');
  });

  it('labels the bar "Complete" and fills it with the stronger accent', () => {
    renderCard({ ownedCount: 12, totalCount: 12, nextMissingTitle: null });
    const bar = screen.getByTestId('set-card-progress');

    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-label', 'Complete');
    expect(bar.querySelector<HTMLElement>('[style*="width"]')?.className).toContain('bg-accent-700');
  });

  it('shows no next line, no to-find line and no missing badge', () => {
    renderCard({ ownedCount: 12, totalCount: 12, nextMissingTitle: 'Ignored Oblast' });

    expect(screen.queryByTestId('set-card-next')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-card-to-find')).not.toBeInTheDocument();
    expect(screen.queryByText('Ignored Oblast', { exact: false })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('set-card')).getAllByTestId('badge')).toHaveLength(1);
  });

  it('does not show "Every coin found" while a coin is missing', () => {
    renderCard({ ownedCount: 11, totalCount: 12 });
    expect(screen.queryByTestId('set-card-every-found')).not.toBeInTheDocument();
  });
});

describe('SetCard: empty set', () => {
  it('shows 0% and is not complete when the set has no coins', () => {
    renderCard({ ownedCount: 0, totalCount: 0, nextMissingTitle: null });

    expect(screen.getByTestId('set-card')).toHaveAttribute('data-complete', 'false');
    expect(screen.getByTestId('set-card-percent')).toHaveTextContent(/^0%$/);
    expect(screen.getByTestId('set-card-progress')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByTestId('set-card-every-found')).not.toBeInTheDocument();
  });
});

describe('SetCard: loading', () => {
  it('renders only a busy skeleton with four skeleton lines', () => {
    renderCard({ loading: true });
    const skeleton = screen.getByTestId('set-card-skeleton');

    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(within(skeleton).getAllByTestId('skeleton')).toHaveLength(4);
  });

  it('renders none of the card content while loading', () => {
    renderCard({ loading: true });

    expect(screen.queryByTestId('set-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-card-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-card-progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-card-owned')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
  });
});
