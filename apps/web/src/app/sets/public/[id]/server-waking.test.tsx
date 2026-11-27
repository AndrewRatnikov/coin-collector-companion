/**
 * Tests for: PublicSetDetailView (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 *                   runs/run_20261127_120807/plan.md § Approach §8 (render the view, not the async server page)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors sets/public/[id]/page.test.tsx. useSlowLoading is deliberately not mocked.
 * run_20261127_120807: only the import and the setup helper change (the page is now a server component,
 * the id is a prop).
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PublicSetDetailView } from '@/components/sets/public-set-detail-view';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function publicSetResult(overrides: Partial<ReturnType<typeof usePublicSet>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof usePublicSet>;
}

function gapsResult(overrides: Partial<ReturnType<typeof useSetGaps>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useSetGaps>;
}

const DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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
  const ui = () => <PublicSetDetailView id="set-1" />;
  return { view: render(ui()), ui };
}

describe('PublicSetDetailView: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    useSetGapsMock.mockReturnValue(gapsResult());
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s inside the loading block, and gone once the set resolves', async () => {
    usePublicSetMock.mockReturnValue(publicSetResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();

    expect(screen.getByTestId('public-set-detail-loading')).toBeInTheDocument();
    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server.');
    expect(screen.getByTestId('public-set-detail-loading')).toContainElement(notice);

    usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
    view.rerender(ui());
    await flushParams();

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-set-detail-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-set-detail-name')).toBeInTheDocument();
  });

  it('never appears when the set resolves before 3 s', async () => {
    usePublicSetMock.mockReturnValue(publicSetResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();
    advance(2000);

    usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
    view.rerender(ui());
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('is not driven by the gaps query: the set is there and the gaps are still loading', async () => {
    usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
    useSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
    setup();
    await flushParams();

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
