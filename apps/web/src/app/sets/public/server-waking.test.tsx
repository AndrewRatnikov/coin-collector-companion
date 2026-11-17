/**
 * Tests for: PublicSetsPage (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors sets/public/page.test.tsx. useSlowLoading is deliberately not mocked.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import PublicSetsPage from '@/app/sets/public/page';
import { usePublicSets } from '@/lib/hooks/use-public-sets';

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
}));

const usePublicSetsMock = vi.mocked(usePublicSets);

function queryResult(overrides: Partial<ReturnType<typeof usePublicSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof usePublicSets>;
}

const SETS = [
  {
    id: 'u1',
    userId: 'user-1',
    name: 'Alice Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    minGrade: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    coinCount: 3,
  },
];

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('PublicSetsPage: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePublicSetsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s inside the loading block, and gone once data resolves', () => {
    usePublicSetsMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<PublicSetsPage />);

    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server.');
    expect(screen.getByTestId('public-sets-loading')).toContainElement(notice);

    usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 20, total: 1 } }));
    view.rerender(<PublicSetsPage />);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-sets-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-sets-list')).toBeInTheDocument();
  });

  it('never appears when the query resolves before 3 s', () => {
    usePublicSetsMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<PublicSetsPage />);
    advance(2000);

    usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 20, total: 1 } }));
    view.rerender(<PublicSetsPage />);
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('does not appear on an error', () => {
    usePublicSetsMock.mockReturnValue(queryResult({ isError: true }));
    render(<PublicSetsPage />);

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
