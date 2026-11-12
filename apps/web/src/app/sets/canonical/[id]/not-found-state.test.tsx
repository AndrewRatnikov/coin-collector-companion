/**
 * Tests for: CanonicalSetDetailPage not-found state
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Detail pages (modified)
 * Covers criteria: #10, #11, #12
 *
 * Mock setup mirrors progress.test.tsx (Suspense around the page; gaps hook mocked).
 *
 * CONTRACT_GAPS: none
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CanonicalSetDetailPage from '@/app/sets/canonical/[id]/page';
import { ApiError } from '@/lib/api-client';
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

function setResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCanonicalSet>;
}

function gapsResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCanonicalSetGaps>;
}

function renderPage(id = 'set-1') {
  return render(
    <Suspense fallback={<div />}>
      <CanonicalSetDetailPage params={Promise.resolve({ id })} />
    </Suspense>,
  );
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
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [{ id: 'usc-1', position: 0, coin: COIN_1 }],
};

describe('CanonicalSetDetailPage: not-found state', () => {
  beforeEach(() => {
    useCanonicalSetMock.mockReset();
    useCanonicalSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useCanonicalSetGapsMock.mockReturnValue(gapsResult());
  });

  it.each([404, 400])('shows the checklist not-found state for an ApiError %i', async (status) => {
    useCanonicalSetMock.mockReturnValue(setResult({ isError: true, error: new ApiError(status, 'x') }));
    renderPage();

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toHaveAttribute('data-variant', 'checklist');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This checklist doesn't exist");
    expect(screen.queryByTestId('canonical-set-detail-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('canonical-set-detail-page')).toContainElement(notFound);
  });

  it.each([
    ['a 500 ApiError', new ApiError(500, 'boom')],
    ['a 403 ApiError', new ApiError(403, 'no')],
    ['a plain network Error', new Error('Failed to fetch')],
  ])('keeps the existing error UI for %s', async (_label, error) => {
    useCanonicalSetMock.mockReturnValue(setResult({ isError: true, error }));
    renderPage();

    expect(await screen.findByTestId('canonical-set-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('keeps the existing error UI when isError is true and there is no error object', async () => {
    useCanonicalSetMock.mockReturnValue(setResult({ isError: true }));
    renderPage();

    expect(await screen.findByTestId('canonical-set-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('does not show not-found when the checklist loads but the gaps query fails with 404', async () => {
    getStoredTokenMock.mockReturnValue('tok-abc');
    useCanonicalSetMock.mockReturnValue(setResult({ data: DETAIL }));
    useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isError: true, error: new ApiError(404, 'Not Found') }));
    renderPage();

    expect(await screen.findByTestId('canonical-set-detail-name')).toHaveTextContent('Lincoln Wheat Cents');
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});
