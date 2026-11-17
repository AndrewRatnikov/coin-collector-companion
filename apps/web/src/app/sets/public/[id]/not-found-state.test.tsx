/**
 * Tests for: PublicSetDetailPage not-found state
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Detail pages (modified)
 * Covers criteria: #9, #11, #12
 *
 * Mock setup mirrors progress.test.tsx.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicSetDetailPage from '@/app/sets/public/[id]/page';
import { ApiError } from '@/lib/api-client';
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

function setResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof usePublicSet>;
}

function gapsResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSetGaps>;
}

function renderPage(id = 'set-1') {
  return render(<PublicSetDetailPage params={Promise.resolve({ id })} />);
}

const COIN_1 = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  isKeyDate: false,
};

const DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  coins: [{ id: 'usc-1', position: 0, coin: COIN_1 }],
};

describe('PublicSetDetailPage: not-found state', () => {
  beforeEach(() => {
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useSetGapsMock.mockReturnValue(gapsResult());
  });

  it.each([404, 400])('shows the set not-found state for an ApiError %i', async (status) => {
    usePublicSetMock.mockReturnValue(setResult({ isError: true, error: new ApiError(status, 'x') }));
    renderPage();

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toHaveAttribute('data-variant', 'set');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This set doesn't exist or was deleted");
    expect(screen.queryByTestId('public-set-detail-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-set-detail-page')).toContainElement(notFound);
  });

  it.each([
    ['a 500 ApiError', new ApiError(500, 'boom')],
    ['a 403 ApiError', new ApiError(403, 'no')],
    ['a plain network Error', new Error('Failed to fetch')],
  ])('keeps the existing error UI for %s', async (_label, error) => {
    usePublicSetMock.mockReturnValue(setResult({ isError: true, error }));
    renderPage();

    expect(await screen.findByTestId('public-set-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('keeps the existing error UI when isError is true and there is no error object', async () => {
    usePublicSetMock.mockReturnValue(setResult({ isError: true }));
    renderPage();

    expect(await screen.findByTestId('public-set-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('does not show not-found when the set loads but the gaps query fails with 404', async () => {
    getStoredTokenMock.mockReturnValue('tok-abc');
    usePublicSetMock.mockReturnValue(setResult({ data: DETAIL }));
    useSetGapsMock.mockReturnValue(gapsResult({ isError: true, error: new ApiError(404, 'Not Found') }));
    renderPage();

    expect(await screen.findByTestId('public-set-detail-name')).toHaveTextContent("Alice's Wheat Cents");
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});
