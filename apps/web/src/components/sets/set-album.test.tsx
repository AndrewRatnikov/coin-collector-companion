/**
 * Tests for: SetAlbum and SetViewSwitch components
 * Contract source: runs/run_20261009_211156/plan.md § Interface Contract → Component: SetAlbum, Component: SetViewSwitch
 * Covers criteria: #1 (switch), #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #17, #18, #19
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GapSlot } from '@coin-collector/shared';
import { SetAlbum } from '@/components/sets/set-album';
import { SetViewSwitch } from '@/components/sets/set-view-switch';

function slot(
  position: number,
  id: string,
  over: {
    year: number;
    mintMark?: string;
    variety?: string;
    name?: string;
    country?: string;
    denomination?: string;
    owned?: boolean;
    isKeyDate?: boolean;
  },
): GapSlot {
  return {
    id: `usc-${id}`,
    position,
    owned: over.owned ?? false,
    coin: {
      id: `coin-${id}`,
      country: over.country ?? 'USA',
      denomination: over.denomination ?? 'Cent',
      year: over.year,
      mintMark: over.mintMark ?? '',
      variety: over.variety ?? '',
      name: over.name ?? 'Lincoln Wheat Cent',
      imageUrl: null,
      imageSource: null,
      imageLicense: null,
      diameterMm: null,
      weightG: null,
      thicknessMm: null,
      material: null,
      mintage: null,
      isKeyDate: over.isKeyDate ?? false,
      status: 'approved',
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

// Lincoln page, columns '', D, S; rows 1909, 1931
//   1909: ''  -> plain (owned) + VDB (missing); D -> blank; S -> VDB (owned)
//   1931: ''  -> blank;                          D -> blank; S -> key date (missing)
const L_PLAIN = slot(0, 'plain', { year: 1909, owned: true });
const L_VDB = slot(1, 'vdb', { year: 1909, variety: 'VDB', owned: false });
const L_S_VDB = slot(2, 'svdb', { year: 1909, mintMark: 'S', variety: 'VDB', owned: true });
const L_1931S = slot(3, '1931s', { year: 1931, mintMark: 'S', isKeyDate: true, owned: false });
const L_1931D = slot(4, '1931d', { year: 1931, mintMark: 'D', owned: true });
// Ukrainian page, single '' column
const U_ONE = slot(10, 'u1', {
  year: 2026,
  country: 'Ukraine',
  denomination: '1 Hryvnia',
  name: 'Commemorative',
  variety: 'A very long commemorative variety name that must be truncated visually',
  owned: false,
});

const LINCOLN = [L_PLAIN, L_VDB, L_S_VDB, L_1931S, L_1931D];

function renderAlbum(over: Partial<React.ComponentProps<typeof SetAlbum>> = {}) {
  const onToggle = vi.fn();
  const utils = render(
    <SetAlbum slots={LINCOLN} isOwner={true} gapOnly={false} onToggle={onToggle} {...over} />,
  );
  return { onToggle, ...utils };
}

function slotByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('set-album-slot').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no slot for ${coinId}`);
  return found;
}

describe('SetAlbum: empty', () => {
  it('shows only the empty message, no legend, no pages', () => {
    renderAlbum({ slots: [] });

    expect(screen.getByTestId('set-album')).toBeInTheDocument();
    expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
    expect(screen.queryByTestId('set-album-legend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
  });

  it('points the owner to Add coins', () => {
    renderAlbum({ slots: [] });
    expect(screen.getByTestId('set-album-empty-owner-hint')).toHaveTextContent('Use "Add coins" to start filling it.');
  });

  it('shows no Add coins hint to a non-owner', () => {
    renderAlbum({ slots: [], isOwner: false });
    expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
    expect(screen.queryByTestId('set-album-empty-owner-hint')).not.toBeInTheDocument();
  });

  it('does not show the empty message when there are slots', () => {
    renderAlbum();
    expect(screen.queryByTestId('set-album-empty')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: pages, headings, counts', () => {
  it('renders one page per series, in position order, with heading and count', () => {
    renderAlbum({ slots: [U_ONE, ...LINCOLN] });

    const pages = screen.getAllByTestId('set-album-page');
    expect(pages).toHaveLength(2);
    expect(within(pages[0]).getByTestId('set-album-page-heading').textContent).toBe('Lincoln Wheat Cent · USA');
    expect(within(pages[0]).getByTestId('set-album-page-count').textContent).toBe('3 of 5 owned');
    expect(within(pages[1]).getByTestId('set-album-page-heading').textContent).toBe('Commemorative · Ukraine');
    expect(within(pages[1]).getByTestId('set-album-page-count').textContent).toBe('0 of 1 owned');
  });

  it('renders the legend once above all pages', () => {
    renderAlbum({ slots: [U_ONE, ...LINCOLN] });
    expect(screen.getAllByTestId('set-album-legend')).toHaveLength(1);
  });

  it('renders a table per page with scope=col and scope=row headers', () => {
    renderAlbum();
    const table = screen.getByTestId('set-album-table');
    expect(table.tagName).toBe('TABLE');
    screen.getAllByTestId('set-album-col-header').forEach((th) => {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'col');
    });
    screen.getAllByTestId('set-album-year-header').forEach((th) => {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'row');
    });
  });

  it('puts the table inside the horizontal scroll container', () => {
    renderAlbum();
    const scroll = screen.getByTestId('set-album-scroll');
    expect(scroll.className).toContain('overflow-x-auto');
    expect(within(scroll).getByTestId('set-album-table')).toBeInTheDocument();
  });

  it('renders rows for present years ascending', () => {
    renderAlbum({ slots: [L_1931S, L_PLAIN] });
    const rows = screen.getAllByTestId('set-album-row');
    expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1909', '1931']);
    expect(screen.getAllByTestId('set-album-year-header').map((h) => h.textContent)).toEqual(['1909', '1931']);
  });

  it('renders column headers with the empty mint mark first and as an em dash with a No mint mark label', () => {
    renderAlbum();
    const headers = screen.getAllByTestId('set-album-col-header');
    expect(headers.map((h) => h.getAttribute('data-mint-mark'))).toEqual(['', 'D', 'S']);
    expect(headers[0].textContent).toBe('—');
    const labelled = headers[0].matches('[aria-label="No mint mark"]')
      ? headers[0]
      : headers[0].querySelector('[aria-label="No mint mark"]');
    expect(labelled).not.toBeNull();
    expect(labelled).toHaveAttribute('title', 'No mint mark');
    expect(headers[1].textContent).toBe('D');
    expect(headers[2].textContent).toBe('S');
  });

  it('renders a single column for an all-empty-mint-mark page', () => {
    renderAlbum({ slots: [U_ONE] });
    const headers = screen.getAllByTestId('set-album-col-header');
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toBe('—');
  });

  it('renders column footers with owned/total', () => {
    renderAlbum();
    const footers = screen.getAllByTestId('set-album-col-footer');
    expect(footers.map((f) => f.getAttribute('data-mint-mark'))).toEqual(['', 'D', 'S']);
    // '' : plain owned, VDB missing -> 1/2 ; D : 1931 D owned -> 1/1 ; S : svdb owned, 1931S missing -> 1/2
    expect(footers.map((f) => f.textContent)).toEqual(['1/2', '1/1', '1/2']);
  });

  it('footers and page count change with different ownership', () => {
    const allOwned = LINCOLN.map((s) => ({ ...s, owned: true }));
    renderAlbum({ slots: allOwned });
    expect(screen.getByTestId('set-album-page-count').textContent).toBe('5 of 5 owned');
    expect(screen.getAllByTestId('set-album-col-footer').map((f) => f.textContent)).toEqual(['2/2', '1/1', '2/2']);
  });
});

describe('SetAlbum: cells', () => {
  it('shows several varieties as separate slots in the same cell', () => {
    renderAlbum();
    const cells = screen.getAllByTestId('set-album-cell');
    const cell1909 = cells.find((c) => c.getAttribute('data-year') === '1909' && c.getAttribute('data-mint-mark') === '');
    expect(cell1909).toBeDefined();
    const slots = within(cell1909!).getAllByTestId('set-album-slot');
    expect(slots.map((s) => s.getAttribute('data-coin-id'))).toEqual(['coin-plain', 'coin-vdb']);
    expect(within(cell1909!).getAllByTestId('set-album-slot-variety').map((v) => v.textContent)).toEqual(['VDB']);
  });

  it('renders blank cells for years/mint marks with no coin, with no slot or focusable element', () => {
    renderAlbum();
    const blanks = screen.getAllByTestId('set-album-blank-cell');
    // 1909 D, 1931 ''
    expect(blanks).toHaveLength(2);
    expect(
      blanks.map((b) => `${b.getAttribute('data-year')}|${b.getAttribute('data-mint-mark')}`).sort(),
    ).toEqual(['1909|D', '1931|']);
    blanks.forEach((blank) => {
      expect(blank.tagName).toBe('TD');
      expect(within(blank).queryByTestId('set-album-slot')).not.toBeInTheDocument();
      expect(blank.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull();
      expect(blank.textContent).toBe('No coin in this set');
    });
  });

  it('does not count blank cells: slots total equals the coin count', () => {
    renderAlbum();
    expect(screen.getAllByTestId('set-album-slot')).toHaveLength(LINCOLN.length);
    expect(screen.getAllByTestId('set-album-cell')).toHaveLength(4);
  });

  it('truncates a long variety visually but keeps the full name in title and aria-label', () => {
    renderAlbum({ slots: [U_ONE] });
    const s = screen.getByTestId('set-album-slot');
    expect(s.getAttribute('title')).toContain(U_ONE.coin.variety);
    expect(s.getAttribute('aria-label')).toContain(U_ONE.coin.variety);
    expect(screen.getByTestId('set-album-slot-variety').className).toContain('truncate');
  });
});

describe('SetAlbum: slot appearance and accessible name', () => {
  it('labels a missing key-date slot "1931 S Lincoln Wheat Cent, missing, key date"', () => {
    renderAlbum();
    const s = slotByCoin('coin-1931s');
    expect(s).toHaveAttribute('aria-label', '1931 S Lincoln Wheat Cent, missing, key date');
    expect(s).toHaveAttribute('title', '1931 S Lincoln Wheat Cent, missing, key date');
  });

  it('labels an owned non-key slot without a key date part', () => {
    renderAlbum();
    expect(slotByCoin('coin-plain')).toHaveAttribute('aria-label', '1909 Lincoln Wheat Cent, owned');
    expect(slotByCoin('coin-svdb')).toHaveAttribute('aria-label', '1909 S VDB Lincoln Wheat Cent, owned');
  });

  it('sets data-owned and data-key-date per slot', () => {
    renderAlbum();
    expect(slotByCoin('coin-plain')).toHaveAttribute('data-owned', 'true');
    expect(slotByCoin('coin-vdb')).toHaveAttribute('data-owned', 'false');
    expect(slotByCoin('coin-1931s')).toHaveAttribute('data-key-date', 'true');
    expect(slotByCoin('coin-plain')).toHaveAttribute('data-key-date', 'false');
  });

  it('shows the key-date marker only for key-date coins, hidden from assistive tech', () => {
    renderAlbum();
    const markers = screen.getAllByTestId('set-album-key-date-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0].textContent).toBe('★');
    expect(markers[0]).toHaveAttribute('aria-hidden', 'true');
    expect(within(slotByCoin('coin-1931s')).getByTestId('set-album-key-date-marker')).toBe(markers[0]);
    expect(within(slotByCoin('coin-plain')).queryByTestId('set-album-key-date-marker')).not.toBeInTheDocument();
  });

  it('renders no variety element for an empty variety', () => {
    renderAlbum({ slots: [L_PLAIN] });
    expect(screen.queryByTestId('set-album-slot-variety')).not.toBeInTheDocument();
  });

  it('is not colour-only: owned and missing slots differ in visible glyph text', () => {
    renderAlbum();
    const owned = slotByCoin('coin-plain');
    const missing = slotByCoin('coin-vdb');
    expect(owned.textContent).toContain('✓');
    expect(missing.textContent).not.toContain('✓');
    expect(missing.textContent).toContain('○');
  });

  it('explains the key-date marker in the legend', () => {
    renderAlbum();
    const legend = screen.getByTestId('set-album-legend');
    expect(legend).toHaveTextContent('Key date');
    expect(legend).toHaveTextContent('★');
    expect(legend).toHaveTextContent('Owned');
    expect(legend).toHaveTextContent('Missing');
    expect(legend).toHaveTextContent('Not in this set');
  });

  it('marks only the pending coin aria-busy', () => {
    renderAlbum({ pendingCoinId: 'coin-vdb' });
    expect(slotByCoin('coin-vdb')).toHaveAttribute('aria-busy', 'true');
    expect(slotByCoin('coin-plain')).not.toHaveAttribute('aria-busy');
  });
});

describe('SetAlbum: catalog link', () => {
  it('renders a catalog link per slot with href and aria-label for owners', () => {
    renderAlbum();
    const link = within(slotByCoin('coin-1931s').parentElement!).getByTestId('set-album-slot-catalog-link');
    expect(link).toHaveAttribute('href', '/catalog/coin-1931s');
    expect(link).toHaveAttribute('aria-label', 'View in catalog: 1931 S Lincoln Wheat Cent');
    expect(screen.getAllByTestId('set-album-slot-catalog-link')).toHaveLength(LINCOLN.length);
  });

  it('renders the catalog link for non-owners as well', () => {
    renderAlbum({ isOwner: false });
    expect(screen.getAllByTestId('set-album-slot-catalog-link')).toHaveLength(LINCOLN.length);
  });
});

describe('SetAlbum: owner interaction', () => {
  it('renders slots as buttons for the owner', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-slot').forEach((s) => expect(s.tagName).toBe('BUTTON'));
  });

  it('calls onToggle(coinId, currentlyOwned) exactly once for a missing slot', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();

    await user.click(slotByCoin('coin-vdb'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('coin-vdb', false);
  });

  it('passes currentlyOwned=true for an owned slot', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();

    await user.click(slotByCoin('coin-plain'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
  });

  it('disables only the pending slots, which ignore clicks', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ pendingCoinIds: new Set(['coin-vdb', 'coin-1931s']) });

    expect(slotByCoin('coin-vdb')).toBeDisabled();
    expect(slotByCoin('coin-vdb')).toHaveAttribute('aria-busy', 'true');
    expect(slotByCoin('coin-1931s')).toBeDisabled();
    expect(slotByCoin('coin-plain')).toBeEnabled();
    expect(slotByCoin('coin-plain')).not.toHaveAttribute('aria-busy');

    await user.click(slotByCoin('coin-vdb'));
    expect(onToggle).not.toHaveBeenCalled();
    await user.click(slotByCoin('coin-plain'));
    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
  });

  it('shows a toggle error alert only when toggleFailed is set', () => {
    const { rerender } = renderAlbum();
    expect(screen.queryByTestId('set-album-toggle-error')).not.toBeInTheDocument();

    rerender(<SetAlbum slots={LINCOLN} isOwner={true} gapOnly={false} onToggle={vi.fn()} toggleFailed />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't update this coin. Please try again.");
  });

  it('does not toggle when the catalog link is clicked', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();
    const link = screen.getAllByTestId('set-album-slot-catalog-link')[0];
    // keep jsdom from attempting navigation
    link.addEventListener('click', (e) => e.preventDefault());

    await user.click(link);

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('makes the slot and the catalog link keyboard reachable (natural tab order)', async () => {
    const user = userEvent.setup();
    renderAlbum({ slots: [L_PLAIN] });

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('set-album-slot'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('set-album-slot-catalog-link'));
  });
});

describe('SetAlbum: non-owner', () => {
  it('renders slots as links to the catalog page', () => {
    renderAlbum({ isOwner: false });
    screen.getAllByTestId('set-album-slot').forEach((s) => {
      expect(s.tagName).toBe('A');
      expect(s).toHaveAttribute('href', `/catalog/${s.getAttribute('data-coin-id')}`);
    });
    expect(slotByCoin('coin-vdb')).toHaveAttribute('href', '/catalog/coin-vdb');
  });

  it('never calls onToggle on click', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ isOwner: false });
    const s = slotByCoin('coin-vdb');
    s.addEventListener('click', (e) => e.preventDefault());

    await user.click(s);

    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('SetAlbum: Missing filter (gapOnly)', () => {
  it('keeps every slot, cell and blank cell, and mutes only owned slots', () => {
    renderAlbum({ gapOnly: true });

    expect(screen.getAllByTestId('set-album-slot')).toHaveLength(LINCOLN.length);
    expect(screen.getAllByTestId('set-album-blank-cell')).toHaveLength(2);
    expect(screen.getAllByTestId('set-album-cell')).toHaveLength(4);
    expect(slotByCoin('coin-plain')).toHaveAttribute('data-muted', 'true');
    expect(slotByCoin('coin-svdb')).toHaveAttribute('data-muted', 'true');
    expect(slotByCoin('coin-vdb')).toHaveAttribute('data-muted', 'false');
    expect(slotByCoin('coin-1931s')).toHaveAttribute('data-muted', 'false');
  });

  it('mutes nothing when gapOnly is false', () => {
    renderAlbum({ gapOnly: false });
    screen.getAllByTestId('set-album-slot').forEach((s) => expect(s).toHaveAttribute('data-muted', 'false'));
  });

  it('muted slots are still interactive for the owner', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ gapOnly: true });

    await user.click(slotByCoin('coin-plain'));

    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
  });

  it('keeps counts unchanged by the filter', () => {
    renderAlbum({ gapOnly: true });
    expect(screen.getByTestId('set-album-page-count').textContent).toBe('3 of 5 owned');
  });
});

describe('SetViewSwitch', () => {
  it('renders a labelled group with List and Album buttons', () => {
    render(<SetViewSwitch view="list" onChange={vi.fn()} />);

    const group = screen.getByTestId('set-editor-view-switch');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-label', 'View');
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveTextContent('List');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveTextContent('Album');
  });

  it('reflects the current view in aria-pressed', () => {
    const { rerender } = render(<SetViewSwitch view="list" onChange={vi.fn()} />);
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'false');

    rerender(<SetViewSwitch view="album" onChange={vi.fn()} />);
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the clicked view', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SetViewSwitch view="list" onChange={onChange} />);

    await user.click(screen.getByTestId('set-editor-view-album-toggle'));
    expect(onChange).toHaveBeenLastCalledWith('album');

    await user.click(screen.getByTestId('set-editor-view-list-toggle'));
    expect(onChange).toHaveBeenLastCalledWith('list');
  });
});
