/**
 * Tests for: MySetsSummary
 * Contract source: runs/run_20261018_105617/plan.md § Interface Contract → Component: MySetsSummary
 * Covers criteria: #4 (three tiles, closest excludes complete, complete state) (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { UserSetListItem, UserSetsSummaryResponse } from '@coin-collector/shared';
import { MySetsSummary } from '@/components/dashboard/my-sets-summary';

function makeSet(over: Partial<UserSetListItem> & Pick<UserSetListItem, 'id' | 'name'>): UserSetListItem {
  return {
    userId: 'user-1',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownedCount: 0,
    totalCount: 10,
    firstMissing: null,
    ...over,
  };
}

const SUMMARY: UserSetsSummaryResponse = { uniqueMissingCount: 14, collectionCount: 52, suggestedSet: null };

function renderSummary(sets: UserSetListItem[], summary: UserSetsSummaryResponse = SUMMARY) {
  return render(<MySetsSummary sets={sets} summary={summary} />);
}

describe('MySetsSummary: structure', () => {
  it('renders the summary region with the three tiles', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })]);

    expect(screen.getByTestId('dashboard-summary')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tile-missing')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tile-closest')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-tile-collection')).toBeInTheDocument();
  });

  it('labels the region "Summary"', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })]);

    expect(screen.getByTestId('dashboard-summary')).toHaveAttribute('aria-label', 'Summary');
  });
});

describe('MySetsSummary: missing tile', () => {
  it('shows the unique missing count from the summary', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })]);
    expect(screen.getByTestId('dashboard-tile-missing-value')).toHaveTextContent(/^14$/);
  });

  it('shows a different count for a different summary', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })], {
      ...SUMMARY,
      uniqueMissingCount: 3,
    });
    expect(screen.getByTestId('dashboard-tile-missing-value')).toHaveTextContent(/^3$/);
  });

  it('shows 0 rather than hiding the value when nothing is missing', () => {
    renderSummary([makeSet({ id: 's1', name: 'Done', ownedCount: 4, totalCount: 4 })], {
      ...SUMMARY,
      uniqueMissingCount: 0,
    });
    expect(screen.getByTestId('dashboard-tile-missing-value')).toHaveTextContent(/^0$/);
  });

  it('links "See what to look for" to the missing list of the closest set', () => {
    renderSummary([
      makeSet({ id: 'far', name: 'Far', ownedCount: 1, totalCount: 10 }),
      makeSet({ id: 'near', name: 'Near', ownedCount: 9, totalCount: 10 }),
    ]);

    const link = screen.getByTestId('dashboard-tile-missing-link');
    expect(link).toHaveAttribute('href', '/sets/near/missing');
    expect(link).toHaveTextContent('See what to look for');
  });

  it('points the link at a different set when the closest set differs', () => {
    renderSummary([
      makeSet({ id: 'far', name: 'Far', ownedCount: 9, totalCount: 10 }),
      makeSet({ id: 'near', name: 'Near', ownedCount: 1, totalCount: 10 }),
    ]);

    expect(screen.getByTestId('dashboard-tile-missing-link')).toHaveAttribute('href', '/sets/far/missing');
  });

  it('does not render the link when every set is complete', () => {
    renderSummary([makeSet({ id: 'done', name: 'Done', ownedCount: 4, totalCount: 4 })]);

    expect(screen.queryByTestId('dashboard-tile-missing-link')).not.toBeInTheDocument();
  });

  it('does not render the link when there is no incomplete set with coins', () => {
    renderSummary([makeSet({ id: 'empty', name: 'Empty', ownedCount: 0, totalCount: 0 })]);

    expect(screen.queryByTestId('dashboard-tile-missing-link')).not.toBeInTheDocument();
  });
});

describe('MySetsSummary: closest tile', () => {
  it('names the closest set with the coins to go and the first missing coin', () => {
    renderSummary([
      makeSet({ id: 'a', name: 'Other', ownedCount: 2, totalCount: 10, firstMissing: 'Kyiv Oblast' }),
      makeSet({ id: 'b', name: 'We Are Strong', ownedCount: 1, totalCount: 10, firstMissing: 'Odesa Oblast' }),
      makeSet({ id: 'c', name: 'Almost', ownedCount: 7, totalCount: 16, firstMissing: 'Lviv Oblast' }),
    ]);

    // Closest is "Other"? 2/10 = 0.2 vs 1/10 vs 7/16 = 0.44 -> Almost.
    expect(screen.getByTestId('dashboard-tile-closest-name')).toHaveTextContent('Almost');
    expect(screen.getByTestId('dashboard-tile-closest-detail')).toHaveTextContent('9 coins to go · Lviv Oblast');
  });

  it('uses the singular for one coin to go', () => {
    renderSummary([
      makeSet({ id: 'a', name: 'Nearly', ownedCount: 11, totalCount: 12, firstMissing: 'Zaporizhzhia Oblast' }),
    ]);

    expect(screen.getByTestId('dashboard-tile-closest-detail')).toHaveTextContent(
      '1 coin to go · Zaporizhzhia Oblast',
    );
    expect(screen.getByTestId('dashboard-tile-closest-detail')).not.toHaveTextContent('1 coins');
  });

  it('omits the first-missing part when the API sent none', () => {
    renderSummary([makeSet({ id: 'a', name: 'No title', ownedCount: 7, totalCount: 10, firstMissing: null })]);

    const detail = screen.getByTestId('dashboard-tile-closest-detail');
    expect(detail).toHaveTextContent('3 coins to go');
    expect(detail).not.toHaveTextContent('·');
  });

  it('skips complete sets when picking the closest', () => {
    renderSummary([
      makeSet({ id: 'done', name: 'Complete one', ownedCount: 5, totalCount: 5 }),
      makeSet({ id: 'wip', name: 'In progress', ownedCount: 1, totalCount: 5, firstMissing: 'Sumy Oblast' }),
    ]);

    expect(screen.getByTestId('dashboard-tile-closest-name')).toHaveTextContent('In progress');
    expect(screen.queryByTestId('dashboard-tile-closest-complete')).not.toBeInTheDocument();
  });

  it('shows the complete state with a Complete badge when every set is complete', () => {
    renderSummary([
      makeSet({ id: 'a', name: 'One', ownedCount: 5, totalCount: 5 }),
      makeSet({ id: 'b', name: 'Two', ownedCount: 2, totalCount: 2 }),
    ]);

    const complete = screen.getByTestId('dashboard-tile-closest-complete');
    expect(complete).toHaveTextContent('Every set is complete');
    expect(within(complete).getByTestId('badge')).toHaveAttribute('data-variant', 'complete');
    expect(screen.queryByTestId('dashboard-tile-closest-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tile-closest-detail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tile-closest-no-coins')).not.toBeInTheDocument();
  });

  it('shows the no-coins state when every set is empty', () => {
    renderSummary([makeSet({ id: 'a', name: 'Empty', ownedCount: 0, totalCount: 0 })]);

    expect(screen.getByTestId('dashboard-tile-closest-no-coins')).toHaveTextContent(
      'Add coins to a set to see progress',
    );
    expect(screen.queryByTestId('dashboard-tile-closest-complete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tile-closest-name')).not.toBeInTheDocument();
  });

  it('treats a complete set next to an empty one as complete, not as no-coins', () => {
    renderSummary([
      makeSet({ id: 'a', name: 'Done', ownedCount: 3, totalCount: 3 }),
      makeSet({ id: 'b', name: 'Empty', ownedCount: 0, totalCount: 0 }),
    ]);

    expect(screen.getByTestId('dashboard-tile-closest-complete')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tile-closest-no-coins')).not.toBeInTheDocument();
  });
});

describe('MySetsSummary: collection tile', () => {
  it('shows the collection count and links to /collection', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })]);

    expect(screen.getByTestId('dashboard-tile-collection-value')).toHaveTextContent(/^52$/);
    const link = screen.getByTestId('dashboard-tile-collection-link');
    expect(link).toHaveAttribute('href', '/collection');
    expect(link).toHaveTextContent('Open Collection');
  });

  it('shows a different count for a different summary', () => {
    renderSummary([makeSet({ id: 's1', name: 'Set', ownedCount: 1, totalCount: 4 })], {
      ...SUMMARY,
      collectionCount: 7,
    });

    expect(screen.getByTestId('dashboard-tile-collection-value')).toHaveTextContent(/^7$/);
  });
});
