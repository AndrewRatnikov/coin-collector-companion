/**
 * Tests for: SetEditorPage analytics (want_list_exported from the actions menu CSV item)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The mocking setup mirrors missing-export.test.tsx next to this file. The menu's "Print missing list"
 * item is a link to /sets/{id}/missing, not a print, so it must not track anything. A throwing handler
 * is reported by React as a window error event; the listener below marks it handled.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SetEditorPage from '@/app/sets/[id]/page';
import { downloadMissingCsv } from '@/lib/missing-list';
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
import { useBulkSetOwnership, useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';
import { track } from '@/lib/analytics';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadMissingCsv: vi.fn(),
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
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const trackMock = vi.mocked(track);
const downloadMock = vi.mocked(downloadMissingCsv);
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
const useCatalogMock = vi.mocked(useCatalog);

const swallowError = (event: ErrorEvent) => event.preventDefault();

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), isPending: false } as never;
}

const COIN_1 = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_2 = { ...COIN_1, id: 'coin-2', year: 1958, name: 'Memorial Cent' };

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 0, coin: COIN_1 },
    { id: 'usc-2', position: 1, coin: COIN_2 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 0,
  totalCount: 2,
  completionPercent: 0,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: false },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false },
  ],
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

function setDefaultMocks() {
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
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

async function findMenuItem(testId: string): Promise<HTMLElement> {
  const trigger = await screen.findByTestId('set-editor-actions-trigger');
  if (!screen.queryByTestId('set-editor-actions-menu')) fireEvent.click(trigger);
  return screen.findByTestId(testId);
}

describe('SetEditorPage analytics: download missing from the actions menu', () => {
  beforeEach(() => {
    localStorage.clear();
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
      useCatalogMock,
    ].forEach((m) => m.mockReset());
    setDefaultMocks();
    setStoredToken('token');
    trackMock.mockClear();
    downloadMock.mockReset();
    window.addEventListener('error', swallowError);
  });

  afterEach(() => {
    window.removeEventListener('error', swallowError);
  });

  it('tracks one csv export of a set when the menu item is clicked, and not before', async () => {
    renderPage();
    const item = await findMenuItem('set-editor-download-missing');
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(item);

    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'csv', scope: 'set' });
  });

  it('tracks nothing when the download throws', async () => {
    downloadMock.mockImplementation(() => {
      throw new Error('download failed');
    });
    renderPage();

    fireEvent.click(await findMenuItem('set-editor-download-missing'));

    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('opening the menu alone tracks nothing', async () => {
    renderPage();

    await findMenuItem('set-editor-download-missing');

    expect(trackMock).not.toHaveBeenCalled();
  });
});
