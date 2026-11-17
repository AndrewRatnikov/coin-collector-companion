/**
 * Tests for: CoinCard (density, titleOverride, ownedStatusLabel, linkToCoin, readOnly) and Badge size
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → CoinCard (additions), Badge (addition)
 * Covers criteria: #10 (from prd.md)
 *
 * coin-card.test.tsx and badge.test.tsx are unchanged: every new prop is optional and the defaults keep
 * today's output, which the "defaults" tests below also pin.
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CatalogCoin } from '@coin-collector/shared';
import { Badge } from '@/components/ui/badge';
import { CoinCard, type CoinCardProps } from '@/components/ui/coin-card';
import en from '@/lib/i18n/locales/en';

const BASE: CatalogCoin = {
  id: 'sample-1909-S-VDB',
  country: 'United States',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: 'Bronze',
  mintage: null,
  isKeyDate: true,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-11-16T00:00:00Z'),
  updatedAt: new Date('2026-11-16T00:00:00Z'),
};

const PLAIN: CatalogCoin = { ...BASE, id: 'sample-1910', year: 1910, mintMark: '', variety: '', isKeyDate: false };

function renderCard(over: Partial<CoinCardProps> = {}) {
  return render(<CoinCard coin={BASE} owned={false} {...over} />);
}

describe('CoinCard: defaults are unchanged', () => {
  it('is data-density="default" with eyebrow, subtitle, link and toggle', () => {
    renderCard();

    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-density', 'default');
    expect(screen.getByTestId('coin-card-eyebrow')).toBeInTheDocument();
    expect(screen.getByTestId('coin-card-subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/sample-1909-S-VDB');
    expect(screen.getByTestId('status-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('coin-card-check')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^1909-S VDB$/);
  });

  it('keeps the key-date badge inside the well at default density', () => {
    renderCard();

    const badge = screen.getByTestId('badge');
    expect(within(screen.getByTestId('coin-card-well')).getByTestId('badge')).toBe(badge);
    expect(badge).toHaveAttribute('data-size', 'default');
  });

  it('shows the translated owned label by default', () => {
    renderCard({ owned: true });

    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(en['ui.coin.statusOwned']);
  });
});

describe('CoinCard: density="compact"', () => {
  it('reports data-density="compact"', () => {
    renderCard({ density: 'compact' });

    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-density', 'compact');
  });

  it('drops the eyebrow and the subtitle that the default density shows for the same coin', () => {
    const { unmount } = renderCard();
    expect(screen.getByTestId('coin-card-eyebrow')).toBeInTheDocument();
    expect(screen.getByTestId('coin-card-subtitle')).toBeInTheDocument();
    unmount();

    renderCard({ density: 'compact' });

    expect(screen.queryByTestId('coin-card-eyebrow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-card-subtitle')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-title')).toBeInTheDocument();
  });

  it('moves the key-date badge out of the well into the body as a small badge', () => {
    renderCard({ density: 'compact' });

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-variant', 'key-date');
    expect(badge).toHaveAttribute('data-size', 'small');
    expect(within(screen.getByTestId('coin-card-well')).queryByTestId('badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card')).toContainElement(badge);
  });

  it('shows no badge for a coin that is not a key date', () => {
    renderCard({ coin: PLAIN, density: 'compact' });

    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
  });

  it('has no hover or focus lift classes, which the default density has', () => {
    const { unmount } = renderCard();
    expect(screen.getByTestId('coin-card').className).toMatch(/translate-y/);
    unmount();

    renderCard({ density: 'compact' });

    expect(screen.getByTestId('coin-card').className).not.toMatch(/translate-y/);
  });
});

describe('CoinCard: titleOverride', () => {
  it('replaces the getCoinName title', () => {
    renderCard({ titleOverride: '1909-S VDB (sample)' });

    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^1909-S VDB \(sample\)$/);
  });

  it('follows the value it is given', () => {
    const { unmount } = renderCard({ titleOverride: 'First' });
    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^First$/);
    unmount();

    renderCard({ titleOverride: 'Second' });

    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^Second$/);
  });

  it('works together with compact density', () => {
    renderCard({ coin: PLAIN, density: 'compact', titleOverride: '1910' });

    expect(screen.getByTestId('coin-card-title')).toHaveTextContent(/^1910$/);
  });
});

describe('CoinCard: ownedStatusLabel', () => {
  it('replaces the owned status text', () => {
    renderCard({ owned: true, ownedStatusLabel: 'Have it' });

    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Have it$/);
  });

  it('is ignored while the coin is missing, where missingStatusLabel applies', () => {
    renderCard({ owned: false, ownedStatusLabel: 'Have it', missingStatusLabel: 'Need it' });

    const status = screen.getByTestId('coin-card-status');
    expect(status).toHaveTextContent(/^Need it$/);
    expect(status).not.toHaveTextContent('Have it');
  });
});

describe('CoinCard: linkToCoin', () => {
  it('renders no link and keeps the title as plain text when false', () => {
    renderCard({ linkToCoin: false });

    expect(screen.queryByTestId('coin-card-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-card-title')).toBeInTheDocument();
    expect(within(screen.getByTestId('coin-card')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the link to the coin page when true', () => {
    renderCard({ linkToCoin: true });

    expect(screen.getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/sample-1909-S-VDB');
  });
});

describe('CoinCard: readOnly', () => {
  it('replaces the StatusToggle with an aria-hidden check and leaves no button', () => {
    renderCard({ readOnly: true, owned: true });

    const check = screen.getByTestId('coin-card-check');
    expect(check).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('coin-card')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not call onToggle when the check is clicked', () => {
    const onToggle = vi.fn();
    renderCard({ readOnly: true, onToggle });

    fireEvent.click(screen.getByTestId('coin-card-check'));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws the owned check solid and the missing check dashed', () => {
    const owned = renderCard({ readOnly: true, owned: true });
    const ownedHtml = screen.getByTestId('coin-card-check').outerHTML;
    owned.unmount();

    renderCard({ readOnly: true, owned: false });
    const missingHtml = screen.getByTestId('coin-card-check').outerHTML;

    expect(ownedHtml).not.toContain('border-dashed');
    expect(missingHtml).toContain('border-dashed');
    expect(ownedHtml).not.toBe(missingHtml);
  });

  it('keeps the data-state on the card so owned and missing stay distinguishable', () => {
    const owned = renderCard({ readOnly: true, owned: true });
    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-state', 'owned');
    owned.unmount();

    renderCard({ readOnly: true, owned: false });

    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-state', 'missing');
  });

  it('shows the StatusToggle and no check by default', () => {
    renderCard({ owned: true });

    expect(screen.getByTestId('status-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('coin-card-check')).not.toBeInTheDocument();
  });

  it('combines with compact density as the landing demo does', () => {
    renderCard({
      readOnly: true,
      density: 'compact',
      linkToCoin: false,
      titleOverride: '1909-S VDB',
      ownedStatusLabel: 'Owned',
      missingStatusLabel: 'Missing',
    });

    expect(screen.getByTestId('coin-card')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByTestId('coin-card-check')).toBeInTheDocument();
    expect(screen.getByTestId('coin-card-status')).toHaveTextContent(/^Missing$/);
    expect(screen.queryByTestId('coin-card-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
  });
});

describe('Badge: size', () => {
  it('defaults to data-size="default" with the 22px height', () => {
    render(<Badge variant="key-date" />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-size', 'default');
    expect(badge.className).toContain('h-[22px]');
    expect(badge.className).not.toContain('h-[18px]');
  });

  it('size="small" sets data-size and the 18px height with 10px text', () => {
    render(<Badge variant="key-date" size="small" />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('data-size', 'small');
    expect(badge.className).toContain('h-[18px]');
    expect(badge.className).toContain('text-[10px]');
    expect(badge.className).not.toContain('h-[22px]');
  });

  it('keeps the label and variant at the small size', () => {
    render(
      <Badge variant="in-set" size="small">
        Sample
      </Badge>,
    );

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('Sample');
    expect(badge).toHaveAttribute('data-variant', 'in-set');
  });
});
