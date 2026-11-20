/**
 * Tests for: landing WantList analytics (want_list_exported, scope sample)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * A throwing handler is reported by React as a window error event; the listener below marks it handled
 * so only the assertion decides the test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WantList } from '@/components/landing/want-list';
import { LINCOLN_SAMPLE_KEY_DATE_IDS, LINCOLN_SAMPLE_SLOTS } from '@/lib/landing/lincoln-sample';
import { downloadMissingCsv } from '@/lib/missing-list';
import { track } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadMissingCsv: vi.fn(),
}));

const trackMock = vi.mocked(track);
const downloadMock = vi.mocked(downloadMissingCsv);

const swallowError = (event: ErrorEvent) => event.preventDefault();

function renderList() {
  return render(<WantList slots={LINCOLN_SAMPLE_SLOTS} keyDateIds={LINCOLN_SAMPLE_KEY_DATE_IDS} />);
}

describe('WantList analytics', () => {
  beforeEach(() => {
    trackMock.mockClear();
    downloadMock.mockReset();
    window.addEventListener('error', swallowError);
  });

  afterEach(() => {
    window.removeEventListener('error', swallowError);
    vi.restoreAllMocks();
  });

  it('tracks a print export of the sample, once per click', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderList();
    expect(trackMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('want-list-print'));

    expect(print).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'print', scope: 'sample' });
  });

  it('tracks a csv export of the sample, once per click', () => {
    renderList();

    fireEvent.click(screen.getByTestId('want-list-csv'));

    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('want_list_exported', { format: 'csv', scope: 'sample' });
  });

  it('tracks nothing when print throws', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('print failed');
    });
    renderList();

    fireEvent.click(screen.getByTestId('want-list-print'));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the csv download throws', () => {
    downloadMock.mockImplementation(() => {
      throw new Error('download failed');
    });
    renderList();

    fireEvent.click(screen.getByTestId('want-list-csv'));

    expect(trackMock).not.toHaveBeenCalled();
  });
});
