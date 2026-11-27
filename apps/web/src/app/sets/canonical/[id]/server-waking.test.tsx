/**
 * Tests for: CanonicalSetDetailView (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 *                   runs/run_20261127_120807/plan.md § Approach §8 (render the view, not the async server page)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors sets/canonical/[id]/page.test.tsx. useSlowLoading is deliberately not mocked.
 * run_20261127_120807: only the import and the setup helper change (the page is now a server component,
 * the id is a prop, so no Suspense wrapper is needed).
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CanonicalSetDetailView } from '@/components/sets/canonical-set-detail-view';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { useCanonicalSetGaps } from '@/lib/hooks/use-user-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useCanonicalSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const useCanonicalSetGapsMock = vi.mocked(useCanonicalSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function queryResult(overrides: Partial<ReturnType<typeof useCanonicalSet>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCanonicalSet>;
}

function gapsResult(overrides: Partial<ReturnType<typeof useCanonicalSetGaps>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useCanonicalSetGaps>;
}

const DETAIL = {
  id: 'set-1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [
    {
      id: 'usc-1',
      position: 0,
      coin: {
        id: 'coin-1',
        country: 'USA',
        denomination: '1 Cent',
        year: 1909,
        mintMark: 'S',
        variety: '',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
    },
  ],
};

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function flushParams() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setup() {
  const ui = () => <CanonicalSetDetailView id="set-1" />;
  return { view: render(ui()), ui };
}

describe('CanonicalSetDetailView: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCanonicalSetMock.mockReset();
    useCanonicalSetGapsMock.mockReset();
    useCanonicalSetGapsMock.mockReturnValue(gapsResult());
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s inside the loading block, and gone once the set resolves', async () => {
    useCanonicalSetMock.mockReturnValue(queryResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();

    expect(screen.getByTestId('canonical-set-detail-loading')).toBeInTheDocument();
    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server.');
    expect(screen.getByTestId('canonical-set-detail-loading')).toContainElement(notice);

    useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
    view.rerender(ui());
    await flushParams();

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canonical-set-detail-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('canonical-set-detail-name')).toBeInTheDocument();
  });

  it('never appears when the set resolves before 3 s', async () => {
    useCanonicalSetMock.mockReturnValue(queryResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();
    advance(2000);

    useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
    view.rerender(ui());
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('is not driven by the gaps query: the set is there and the gaps are still loading', async () => {
    useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
    useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
    setup();
    await flushParams();

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
