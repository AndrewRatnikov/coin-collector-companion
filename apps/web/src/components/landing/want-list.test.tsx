/**
 * Tests for: WantList
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: WantList
 * Covers criteria: #14, #15 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WantList } from '@/components/landing/want-list';
import en from '@/lib/i18n/locales/en';
import {
  LINCOLN_SAMPLE_CSV_NAME,
  LINCOLN_SAMPLE_KEY_DATE_IDS,
  LINCOLN_SAMPLE_MOBILE_SLOTS,
  LINCOLN_SAMPLE_SLOTS,
} from '@/lib/landing/lincoln-sample';
import { buildMissingCsv, missingCsvFilename } from '@/lib/missing-list';

function renderList(slots = LINCOLN_SAMPLE_SLOTS, keyDateIds: ReadonlySet<string> = LINCOLN_SAMPLE_KEY_DATE_IDS) {
  return render(<WantList slots={slots} keyDateIds={keyDateIds} />);
}

function rowFor(year: string): HTMLElement {
  const row = screen.getAllByTestId('want-list-row').find((r) => r.getAttribute('data-year') === year);
  if (!row) throw new Error(`no row for ${year}`);
  return row;
}

function ownedExcept(ids: string[]) {
  return LINCOLN_SAMPLE_SLOTS.map((slot) => ({ ...slot, owned: !ids.includes(slot.id) }));
}

describe('WantList: content', () => {
  it('is a print region', () => {
    renderList();

    expect(screen.getByTestId('want-list')).toHaveAttribute('data-print-region');
  });

  it('counts the missing coins: 8 for the full sample, 4 for the mobile slice', () => {
    const { unmount } = renderList();
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('8 coins');
    unmount();

    renderList(LINCOLN_SAMPLE_MOBILE_SLOTS);

    expect(screen.getByTestId('want-list-count')).toHaveTextContent('4 coins');
  });

  it('uses the singular for one missing coin', () => {
    renderList(ownedExcept(['sample-1914-D']));

    expect(screen.getByTestId('want-list-count')).toHaveTextContent(/^1 coin$/);
  });

  it('shows the set name and the year range of the slots', () => {
    const { unmount } = renderList();
    expect(screen.getByTestId('want-list-range')).toHaveTextContent('Lincoln Wheat Cents · 1909–1916');
    unmount();

    renderList(LINCOLN_SAMPLE_MOBILE_SLOTS);

    expect(screen.getByTestId('want-list-range')).toHaveTextContent('Lincoln Wheat Cents · 1909–1912');
  });

  it('has one row per year with gaps, in year order, with mints joined by " · " and key dates starred', () => {
    renderList();

    const rows = screen.getAllByTestId('want-list-row');
    expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1909', '1910', '1912', '1914', '1915', '1916']);
    expect(within(rowFor('1909')).getByTestId('want-list-year')).toHaveTextContent('1909');
    expect(within(rowFor('1909')).getByTestId('want-list-mints')).toHaveTextContent('S ★ · S VDB ★');
    expect(within(rowFor('1910')).getByTestId('want-list-mints')).toHaveTextContent(/^S$/);
    expect(within(rowFor('1914')).getByTestId('want-list-mints')).toHaveTextContent('D ★ · S');
    expect(within(rowFor('1914')).getByTestId('want-list-mints')).not.toHaveTextContent('S ★');
  });

  it('has 3 rows for the mobile slice', () => {
    renderList(LINCOLN_SAMPLE_MOBILE_SLOTS);

    expect(screen.getAllByTestId('want-list-row').map((r) => r.getAttribute('data-year'))).toEqual([
      '1909',
      '1910',
      '1912',
    ]);
  });

  it('shows landing.plain for a plain coin and stars it when it is a key date', () => {
    const slots = ownedExcept(['sample-1911']);
    const { unmount } = renderList(slots);
    expect(within(rowFor('1911')).getByTestId('want-list-mints')).toHaveTextContent(/^\(plain\)$/);
    unmount();

    renderList(slots, new Set(['sample-1911']));

    expect(within(rowFor('1911')).getByTestId('want-list-mints')).toHaveTextContent(/^\(plain\) ★$/);
  });

  it('shows the legend and the note', () => {
    renderList();

    expect(screen.getByTestId('want-list-legend')).toHaveTextContent(en['landing.wantKey']);
    expect(screen.getByTestId('want-list-note')).toHaveTextContent(en['landing.wantNote']);
  });

  it('shows the empty message instead of the rows when nothing is missing', () => {
    renderList(ownedExcept([]));

    expect(screen.getByTestId('want-list-empty')).toHaveTextContent(en['landing.wantEmpty']);
    expect(screen.queryAllByTestId('want-list-row')).toHaveLength(0);
  });

  it('shows no empty message while something is missing', () => {
    renderList();

    expect(screen.queryByTestId('want-list-empty')).not.toBeInTheDocument();
  });
});

describe('WantList: Print', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls window.print once when Print is clicked', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderList();
    expect(print).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('want-list-print'));

    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe('WantList: Download CSV', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const createObjectURL = vi.fn();
  let clicked: { download: string; href: string }[];

  function readText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(reader.result as ArrayBuffer)));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 17, 12, 0, 0));
    createObjectURL.mockReset();
    createObjectURL.mockReturnValue('blob:want-list');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    vi.restoreAllMocks();
    vi.useRealTimers();
    URL.createObjectURL = originalCreate ?? (() => 'blob:noop');
    URL.revokeObjectURL = originalRevoke ?? (() => {});
  });

  it('downloads buildMissingCsv of the sample: header plus 8 rows, under the dated sample filename', async () => {
    renderList();

    fireEvent.click(screen.getByTestId('want-list-csv'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const text = await readText(createObjectURL.mock.calls[0][0] as Blob);
    expect(text).toBe(buildMissingCsv({ slots: LINCOLN_SAMPLE_SLOTS }, LINCOLN_SAMPLE_CSV_NAME));
    const body = text.replace(/^﻿/, '');
    expect(body.split('\r\n')).toHaveLength(9);
    expect(body).toContain('Lincoln Wheat Cent,United States,1 Cent,1909,S,VDB,yes,');
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe(missingCsvFilename('Lincoln Wheat Cents sample', new Date(2026, 10, 17, 12)));
    expect(clicked[0].download).toBe('lincoln-wheat-cents-sample-missing-2026-11-17.csv');
  });

  it('exports the slots it was given: the mobile slice has 4 rows', async () => {
    renderList(LINCOLN_SAMPLE_MOBILE_SLOTS);

    fireEvent.click(screen.getByTestId('want-list-csv'));

    const text = await readText(createObjectURL.mock.calls[0][0] as Blob);
    expect(text.replace(/^﻿/, '').split('\r\n')).toHaveLength(5);
    expect(text).toBe(buildMissingCsv({ slots: LINCOLN_SAMPLE_MOBILE_SLOTS }, LINCOLN_SAMPLE_CSV_NAME));
  });
});
