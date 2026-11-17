/**
 * Tests for: CanonicalSetsPage (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors sets/canonical/page.test.tsx. useSlowLoading is deliberately not mocked.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CanonicalSetsPage from '@/app/sets/canonical/page';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

const useCanonicalSetsMock = vi.mocked(useCanonicalSets);

function queryResult(overrides: Partial<ReturnType<typeof useCanonicalSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCanonicalSets>;
}

const SETS = [
  { id: 's1', name: 'Lincoln Wheat Cent Key Dates', description: 'The key dates only', source: 'seed-template', templateVersion: 'v1' },
  { id: 's2', name: 'Lincoln Wheat Cents', description: 'Every year', source: 'seed-template', templateVersion: 'v1' },
];

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('CanonicalSetsPage: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCanonicalSetsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s inside the loading block, and gone once data resolves', () => {
    useCanonicalSetsMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<CanonicalSetsPage />);

    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server.');
    expect(screen.getByTestId('canonical-sets-loading')).toContainElement(notice);

    useCanonicalSetsMock.mockReturnValue(queryResult({ data: SETS as never }));
    view.rerender(<CanonicalSetsPage />);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canonical-sets-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('canonical-sets-list')).toBeInTheDocument();
  });

  it('never appears when the query resolves before 3 s', () => {
    useCanonicalSetsMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<CanonicalSetsPage />);
    advance(2000);

    useCanonicalSetsMock.mockReturnValue(queryResult({ data: SETS as never }));
    view.rerender(<CanonicalSetsPage />);
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('does not appear on an error', () => {
    useCanonicalSetsMock.mockReturnValue(queryResult({ isError: true }));
    render(<CanonicalSetsPage />);

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
