/**
 * Tests for: WantListPage analytics (want_list_exported, scope all)
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
import WantListPage from '@/app/want-list/page';
import { useWantList } from '@/lib/hooks/use-user-sets';
import { setStoredToken } from '@/lib/auth-token';
import { downloadWantListCsv } from '@/lib/missing-list';
import { track } from '@/lib/analytics';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useWantList: vi.fn(),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadWantListCsv: vi.fn(),
}));

const trackMock = vi.mocked(track);
const useWantListMock = vi.mocked(useWantList);
const downloadMock = vi.mocked(downloadWantListCsv);

const swallowError = (event: ErrorEvent) => event.preventDefault();

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

const SET_A = { id: 'set-a', name: 'Wheat Cents' };
const DATA = {
  setCount: 1,
  missing: [{ coin: { ...BASE_COIN, id: 'coin-us-1909' }, sets: [SET_A] }],
  upgrades: [],
};

describe('WantListPage analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('t');
    trackMock.mockClear();
    downloadMock.mockReset();
    useWantListMock.mockReset();
    useWantListMock.mockReturnValue({
      data: DATA,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    window.addEventListener('error', swallowError);
  });

  afterEach(() => {
    window.removeEventListener('error', swallowError);
    vi.restoreAllMocks();
  });

  it('tracks a print export of the combined list, once per click', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<WantListPage />);
    const button = await screen.findByTestId('want-list-print-button');
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(print).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'print', scope: 'all' });
  });

  it('tracks a csv export of the combined list, once per click', async () => {
    render(<WantListPage />);
    const button = await screen.findByTestId('want-list-csv-button');
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'csv', scope: 'all' });
  });

  it('tracks nothing when print throws', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('print failed');
    });
    render(<WantListPage />);

    fireEvent.click(await screen.findByTestId('want-list-print-button'));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the csv download throws', async () => {
    downloadMock.mockImplementation(() => {
      throw new Error('download failed');
    });
    render(<WantListPage />);

    fireEvent.click(await screen.findByTestId('want-list-csv-button'));

    expect(trackMock).not.toHaveBeenCalled();
  });
});
