/**
 * Tests for: MySetsEmpty
 * Contract source: runs/run_20261018_105617/plan.md § Interface Contract → Component: MySetsEmpty
 * Covers criteria: #8 (curated CTA, three popular checklists, empty-set link) (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { CanonicalSetSummary } from '@coin-collector/shared';
import { MySetsEmpty } from '@/components/dashboard/my-sets-empty';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

const useCanonicalSetsMock = vi.mocked(useCanonicalSets);

function canonicalResult(overrides: Partial<ReturnType<typeof useCanonicalSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCanonicalSets>;
}

function makeChecklist(id: string, name: string, coinCount: number): CanonicalSetSummary {
  return { id, name, description: null, source: 'admin', templateVersion: '1', coinCount };
}

const CHECKLISTS = [
  makeChecklist('c-small', 'Small checklist', 12),
  makeChecklist('c-huge', 'Huge checklist', 187),
  makeChecklist('c-mid', 'Mid checklist', 75),
  makeChecklist('c-big', 'Big checklist', 120),
  makeChecklist('c-tiny', 'Tiny checklist', 5),
];

describe('MySetsEmpty: primary content', () => {
  beforeEach(() => {
    useCanonicalSetsMock.mockReset();
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS }));
  });

  it('asks the collector to start their first set', () => {
    render(<MySetsEmpty />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Start your first set');
  });

  it('offers one primary "Choose a curated checklist" action that goes to /sets/new', () => {
    render(<MySetsEmpty />);

    const cta = screen.getByTestId('dashboard-empty-curated-cta');
    expect(cta.tagName).toBe('A');
    expect(cta).toHaveTextContent('Choose a curated checklist');
    expect(cta).toHaveAttribute('href', '/sets/new');
  });

  it('offers a quiet "Start an empty set" link to /sets/new', () => {
    render(<MySetsEmpty />);

    const link = screen.getByTestId('dashboard-empty-blank-link');
    expect(link).toHaveTextContent('Start an empty set');
    expect(link).toHaveAttribute('href', '/sets/new');
    expect(screen.getByText(/Prefer to pick every coin yourself\?/)).toBeInTheDocument();
  });

  it('hides the decorative placeholder coins from assistive technology', () => {
    const { container } = render(<MySetsEmpty />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('MySetsEmpty: popular checklists', () => {
  beforeEach(() => {
    useCanonicalSetsMock.mockReset();
  });

  it('lists the three checklists with the most coins, largest first', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS }));
    render(<MySetsEmpty />);

    const list = screen.getByTestId('dashboard-popular-list');
    expect(list.tagName).toBe('UL');
    const items = screen.getAllByTestId('dashboard-popular-item');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Huge checklist');
    expect(items[1]).toHaveTextContent('Big checklist');
    expect(items[2]).toHaveTextContent('Mid checklist');
    expect(within(list).queryByText('Small checklist')).not.toBeInTheDocument();
  });

  it('shows each checklist coin count', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS }));
    render(<MySetsEmpty />);

    const items = screen.getAllByTestId('dashboard-popular-item');
    expect(items[0]).toHaveTextContent('187 coins');
    expect(items[1]).toHaveTextContent('120 coins');
    expect(items[2]).toHaveTextContent('75 coins');
  });

  it('links each checklist to the new-set flow with that checklist preselected', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS }));
    render(<MySetsEmpty />);

    const items = screen.getAllByTestId('dashboard-popular-item');
    expect(items[0]).toHaveAttribute('href', '/sets/new?cloneFrom=canonical&cloneFromId=c-huge');
    expect(items[1]).toHaveAttribute('href', '/sets/new?cloneFrom=canonical&cloneFromId=c-big');
    expect(items[2]).toHaveAttribute('href', '/sets/new?cloneFrom=canonical&cloneFromId=c-mid');
  });

  it('shows fewer than three when fewer checklists exist', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS.slice(0, 2) }));
    render(<MySetsEmpty />);

    expect(screen.getAllByTestId('dashboard-popular-item')).toHaveLength(2);
  });

  it('shows loading skeletons instead of the list while checklists load', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ isLoading: true }));
    render(<MySetsEmpty />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByTestId('dashboard-popular-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-popular-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-empty-curated-cta')).toBeInTheDocument();
  });

  it('omits the popular section when the checklists fail to load, and keeps the main actions', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ isError: true }));
    render(<MySetsEmpty />);

    expect(screen.queryByTestId('dashboard-popular-list')).not.toBeInTheDocument();
    expect(screen.queryByText('Popular checklists')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-empty-curated-cta')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-empty-blank-link')).toBeInTheDocument();
  });

  it('omits the popular section when there are no checklists', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: [] }));
    render(<MySetsEmpty />);

    expect(screen.queryByTestId('dashboard-popular-list')).not.toBeInTheDocument();
    expect(screen.queryByText('Popular checklists')).not.toBeInTheDocument();
  });

  it('shows the "Popular checklists" heading when the list is shown', () => {
    useCanonicalSetsMock.mockReturnValue(canonicalResult({ data: CHECKLISTS }));
    render(<MySetsEmpty />);

    expect(screen.getByText('Popular checklists')).toBeInTheDocument();
  });
});
