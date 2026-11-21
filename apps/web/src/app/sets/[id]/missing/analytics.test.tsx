/**
 * Tests for: SetMissingPage analytics (want_list_exported, scope set)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The mocking setup mirrors page.test.tsx next to this file. A throwing handler is reported by React as
 * a window error event; the listener below marks it handled so only the assertion decides the test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SetMissingPage from '@/app/sets/[id]/missing/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { setStoredToken } from '@/lib/auth-token';
import { downloadMissingCsv } from '@/lib/missing-list';
import { track } from '@/lib/analytics';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadMissingCsv: vi.fn(),
}));

const trackMock = vi.mocked(track);
const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const downloadMissingCsvMock = vi.mocked(downloadMissingCsv);

const swallowError = (event: ErrorEvent) => event.preventDefault();

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: '',
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

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 0,
  totalCount: 2,
  completionPercent: 0,
  minGrade: null,
  slots: [
    { id: 'usc-a', position: 0, coin: { ...BASE_COIN, id: 'coin-a', year: 1958, mintMark: 'D' }, owned: false, grade: null },
    { id: 'usc-b', position: 1, coin: { ...BASE_COIN, id: 'coin-b', year: 1943, mintMark: 'S' }, owned: false, grade: null },
  ],
};

function renderPage(id = 'set-1') {
  return render(<SetMissingPage params={Promise.resolve({ id })} />);
}

describe('SetMissingPage analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('token');
    trackMock.mockClear();
    downloadMissingCsvMock.mockReset();
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    window.addEventListener('error', swallowError);
  });

  afterEach(() => {
    window.removeEventListener('error', swallowError);
    vi.restoreAllMocks();
  });

  it('tracks a print export of one set, once per click', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    const button = await screen.findByTestId('set-missing-print-button');
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(print).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'print', scope: 'set' });
  });

  it('tracks a csv export of one set, once per click', async () => {
    renderPage();
    const button = await screen.findByTestId('set-missing-csv-button');
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(downloadMissingCsvMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'csv', scope: 'set' });
  });

  it('never puts the set name or coin names in the event', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('set-missing-csv-button'));

    expect(JSON.stringify(trackMock.mock.calls)).not.toContain('Wheat');
  });

  it('tracks nothing when print throws', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('print failed');
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('set-missing-print-button'));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the csv download throws', async () => {
    downloadMissingCsvMock.mockImplementation(() => {
      throw new Error('download failed');
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('set-missing-csv-button'));

    expect(trackMock).not.toHaveBeenCalled();
  });
});
