/**
 * Tests for: CollectionSubgroupSection (grade chips on cards and rows)
 * Contract source: runs/run_20261102_220909/plan.md § Interface Contract → Component: CollectionSubgroupSection
 * Covers criteria: #6, #8
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { CatalogCoin, CoinGrade, OwnershipItem } from '@coin-collector/shared';
import { CollectionSubgroupSection } from '@/components/collection/collection-subgroup';
import type { CollectionSubgroup } from '@/lib/collection-view';

function makeCoin(id: string, over: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year: 1909,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

function item(id: string, grade: CoinGrade | null): OwnershipItem {
  return { coinId: id, coin: makeCoin(id), ownedAt: new Date('2026-01-02T00:00:00.000Z'), grade };
}

const ITEMS = [item('coin-a', 'VF'), item('coin-b', null), item('coin-c', 'AU')];
const SUBGROUP: CollectionSubgroup = { key: 'k', name: 'Lincoln', kind: 'series', items: ITEMS };

function renderSection(layout: 'cards' | 'rows', isOwned: (id: string) => boolean = () => true) {
  return render(
    <CollectionSubgroupSection
      subgroup={SUBGROUP}
      open
      onToggleOpen={vi.fn()}
      layout={layout}
      isOwned={isOwned}
      statusFor={() => 'idle'}
      labelsFor={() => ({ toggle: 'x' })}
      onToggleOwned={vi.fn()}
    />,
  );
}

function rowFor(coinId: string) {
  const row = screen.getAllByTestId('collection-row').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!row) throw new Error(`no row for ${coinId}`);
  return row;
}

describe('CollectionSubgroupSection: cards', () => {
  it('shows a grade chip with the code on graded owned cards only', () => {
    renderSection('cards');
    const chips = within(screen.getByTestId('collection-subgroup-cards')).getAllByTestId('coin-card-grade');

    expect(chips.map((c) => c.textContent)).toEqual(['VF', 'AU']);
    expect(chips[0]).toHaveAttribute('title', 'Very Fine');
    expect(chips[1]).toHaveAttribute('title', 'About Uncirculated');
  });

  it('shows no chip for a removed coin, even when it still has a grade', () => {
    renderSection('cards', (id) => id !== 'coin-a');
    const chips = screen.getAllByTestId('coin-card-grade');

    expect(chips.map((c) => c.textContent)).toEqual(['AU']);
  });

  it('shows no chip when nothing is graded', () => {
    render(
      <CollectionSubgroupSection
        subgroup={{ ...SUBGROUP, items: [item('coin-b', null)] }}
        open
        onToggleOpen={vi.fn()}
        layout="cards"
        isOwned={() => true}
        statusFor={() => 'idle'}
        labelsFor={() => ({ toggle: 'x' })}
        onToggleOwned={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('coin-card-grade')).not.toBeInTheDocument();
  });
});

describe('CollectionSubgroupSection: rows', () => {
  it('shows a chip in graded owned rows, outside the link, and none in ungraded rows', () => {
    renderSection('rows');

    const chipA = within(rowFor('coin-a')).getByTestId('collection-row-grade');
    expect(chipA).toHaveTextContent(/^VF$/);
    expect(chipA).toHaveAttribute('title', 'Very Fine');
    expect(within(rowFor('coin-a')).getByTestId('collection-row-link')).not.toContainElement(chipA);
    expect(within(rowFor('coin-c')).getByTestId('collection-row-grade')).toHaveTextContent(/^AU$/);
    expect(within(rowFor('coin-b')).queryByTestId('collection-row-grade')).not.toBeInTheDocument();
  });

  it('shows no chip in a removed row', () => {
    renderSection('rows', (id) => id !== 'coin-a');

    expect(within(rowFor('coin-a')).queryByTestId('collection-row-grade')).not.toBeInTheDocument();
    expect(within(rowFor('coin-c')).getByTestId('collection-row-grade')).toBeInTheDocument();
  });

  it('keeps the link name equal to the title (chip not inside it)', () => {
    renderSection('rows');
    const link = within(rowFor('coin-a')).getByTestId('collection-row-link');
    expect(link).not.toHaveTextContent('VF');
  });
});
