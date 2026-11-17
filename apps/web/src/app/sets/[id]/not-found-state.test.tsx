/**
 * Tests for: SetEditorPage not-found state
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Detail pages (modified)
 * Covers criteria: #8, #11, #12
 *
 * Mock setup mirrors coin-variety-link.test.tsx. The route sits inside RequireAuth, so a token is stored.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SetEditorPage from '@/app/sets/[id]/page';
import { ApiError } from '@/lib/api-client';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import {
  useAddCoinsToSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useUpdateSetMinGrade,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import { useBulkSetOwnership, useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
  useUserSets: vi.fn(),
  usePatchSetCoins: vi.fn(),
  useAddCoinsToSet: vi.fn(),
  useRenameSet: vi.fn(),
  useDeleteSet: vi.fn(),
  useUpdateSetMinGrade: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useSetOwnership: vi.fn(),
  useBulkSetOwnership: vi.fn(),
  useCollection: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const useUserSetsMock = vi.mocked(useUserSets);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useAddCoinsToSetMock = vi.mocked(useAddCoinsToSet);
const useRenameSetMock = vi.mocked(useRenameSet);
const useDeleteSetMock = vi.mocked(useDeleteSet);
const useUpdateSetMinGradeMock = vi.mocked(useUpdateSetMinGrade);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useBulkSetOwnershipMock = vi.mocked(useBulkSetOwnership);
const useCollectionMock = vi.mocked(useCollection);
const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve(undefined)), isPending: false } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

const COIN_1 = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'DDO',
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [{ id: 'usc-1', position: 0, coin: COIN_1 }],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 1,
  completionPercent: 100,
  slots: [{ id: 'usc-1', position: 0, coin: COIN_1, owned: true }],
};

const MY_SETS = [
  {
    id: 'set-1',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

describe('SetEditorPage: not-found state', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/sets/set-1');
    pushMock.mockClear();
    replaceMock.mockClear();
    [
      usePublicSetMock,
      useSetGapsMock,
      useUserSetsMock,
      usePatchSetCoinsMock,
      useAddCoinsToSetMock,
      useRenameSetMock,
      useDeleteSetMock,
      useUpdateSetMinGradeMock,
      useSetOwnershipMock,
      useBulkSetOwnershipMock,
      useCollectionMock,
      useCatalogMock,
      useCatalogFacetsMock,
    ].forEach((m) => m.mockReset());

    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
    usePatchSetCoinsMock.mockReturnValue(mutationMock());
    useAddCoinsToSetMock.mockReturnValue(mutationMock());
    useRenameSetMock.mockReturnValue(mutationMock());
    useDeleteSetMock.mockReturnValue(mutationMock());
    useUpdateSetMinGradeMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined } as never);
    useSetOwnershipMock.mockReturnValue(mutationMock());
    useBulkSetOwnershipMock.mockReturnValue(mutationMock());
    useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
    useCatalogFacetsMock.mockReturnValue(queryResult({ data: { countries: [], denominations: [] } }));
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    setStoredToken('tok-abc');
  });

  it.each([404, 400])('shows the set not-found state for an ApiError %i on the main query', async (status) => {
    usePublicSetMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(status, 'x') }));
    renderPage();

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toHaveAttribute('data-variant', 'set');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This set doesn't exist or was deleted");
    expect(screen.queryByTestId('set-editor-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-editor-page')).toContainElement(notFound);
    expect(await screen.findByTestId('not-found-my-sets-link')).toHaveAttribute('href', '/dashboard');
  });

  it('shows not-found even while the gaps query is still loading', async () => {
    usePublicSetMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(404, 'Not Found') }));
    useSetGapsMock.mockReturnValue(queryResult({ isLoading: true }));
    renderPage();

    expect(await screen.findByTestId('not-found')).toHaveAttribute('data-variant', 'set');
    expect(screen.queryByTestId('set-editor-loading')).not.toBeInTheDocument();
  });

  it('shows not-found even when the gaps query has also failed', async () => {
    usePublicSetMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(404, 'Not Found') }));
    useSetGapsMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(500, 'boom') }));
    renderPage();

    expect(await screen.findByTestId('not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('set-editor-error')).not.toBeInTheDocument();
  });

  it.each([
    ['a 500 ApiError', new ApiError(500, 'boom')],
    ['a 403 ApiError', new ApiError(403, 'no')],
    ['a plain network Error', new Error('Failed to fetch')],
  ])('keeps the existing error UI with retry for %s', async (_label, error) => {
    usePublicSetMock.mockReturnValue(queryResult({ isError: true, error }));
    renderPage();

    expect(await screen.findByTestId('set-editor-error')).toBeInTheDocument();
    expect(screen.getByTestId('set-editor-error-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('does not show not-found when the set loads but the gaps query fails with 404', async () => {
    useSetGapsMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(404, 'Not Found') }));
    renderPage();

    expect(await screen.findByTestId('set-editor-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});
