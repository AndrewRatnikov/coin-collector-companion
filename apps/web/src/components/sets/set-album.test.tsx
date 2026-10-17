/**
 * Tests for: SetAlbum (one year group's grid of CoinCards) and SetViewSwitch
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Component: SetAlbum (rewritten),
 *                  Component: SetViewSwitch (MODIFY)
 * Covers criteria: #1, #7, #8, #9, #14, #17
 *
 * The previous SetAlbum (country/denomination pages with mint-mark tables, legend, decade/year
 * summaries) is gone in this run, so its tests are replaced. The SetViewSwitch tests are kept and
 * updated for Album-first order.
 *
 * Expected card text is computed with getCoinName so the tests do not hard-code the formatter.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoinName, type GapSlot } from '@coin-collector/shared';
import { SetAlbum } from '@/components/sets/set-album';
import { SetViewSwitch } from '@/components/sets/set-view-switch';

function slot(
  position: number,
  id: string,
  over: {
    year: number;
    mintMark?: string;
    variety?: string;
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
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      year: over.year,
      mintMark: over.mintMark ?? '',
      variety: over.variety ?? '',
      name: 'Ukraine Commemorative 10 Hryvnias',
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

const DONETSK = slot(0, 'donetsk', {
  year: 2025,
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  owned: true,
});
const LUHANSK = slot(1, 'luhansk', {
  year: 2025,
  variety: 'We Are Strong. We Are Together: Luhansk Oblast',
  owned: false,
});
const ODESA = slot(2, 'odesa', {
  year: 2025,
  variety: 'We Are Strong. We Are Together: Odesa Oblast',
  owned: false,
  isKeyDate: true,
});

function renderAlbum(over: Partial<React.ComponentProps<typeof SetAlbum>> = {}) {
  const props = {
    slots: [DONETSK, LUHANSK, ODESA],
    visitor: false,
    selectMode: false,
    selectedCoinIds: new Set<string>(),
    statusFor: () => 'idle' as const,
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    ...over,
  };
  const utils = render(<SetAlbum {...props} />);
  return { ...utils, onToggle: props.onToggle, onSelect: props.onSelect };
}

function itemFor(coinId: string) {
  const item = screen
    .getAllByTestId('set-album-item')
    .find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!item) throw new Error(`no album item for ${coinId}`);
  return item;
}

describe('SetAlbum: grid structure (criteria 1, 7)', () => {
  it('renders one ul grid with one li item per slot, in the given order', () => {
    renderAlbum();

    const grid = screen.getByTestId('set-album-grid');
    expect(grid.tagName).toBe('UL');
    const items = screen.getAllByTestId('set-album-item');
    expect(items).toHaveLength(3);
    items.forEach((item) => expect(item.tagName).toBe('LI'));
    expect(items.map((i) => i.getAttribute('data-coin-id'))).toEqual([
      'coin-donetsk',
      'coin-luhansk',
      'coin-odesa',
    ]);
    expect(within(grid).getAllByTestId('coin-card')).toHaveLength(3);
  });

  it('keeps the order it is given (order depends on input, not on a hard-coded list)', () => {
    renderAlbum({ slots: [ODESA, DONETSK] });
    expect(screen.getAllByTestId('set-album-item').map((i) => i.getAttribute('data-coin-id'))).toEqual([
      'coin-odesa',
      'coin-donetsk',
    ]);
  });

  it('renders an empty grid for no slots', () => {
    renderAlbum({ slots: [] });
    expect(screen.queryAllByTestId('set-album-item')).toHaveLength(0);
  });

  it('uses a 2-column grid under 900px and auto-fill columns above', () => {
    renderAlbum();
    const cls = screen.getByTestId('set-album-grid').className;
    expect(cls).toContain('grid-cols-2');
    expect(cls).toContain('auto-fill');
  });
});

describe('SetAlbum: card text comes from getCoinName (criterion 7)', () => {
  it('shows eyebrow, title and subtitle for each coin as getCoinName gives them', () => {
    renderAlbum();

    for (const s of [DONETSK, LUHANSK, ODESA]) {
      const name = getCoinName(s.coin);
      const card = within(itemFor(s.coin.id));
      expect(card.getByTestId('coin-card-title')).toHaveTextContent(name.title);
      expect(card.getByTestId('coin-card-subtitle')).toHaveTextContent(name.subtitle);
      if (name.eyebrow !== '') {
        expect(card.getByTestId('coin-card-eyebrow')).toHaveTextContent(name.eyebrow);
      }
    }
    // the titles differ between coins, so a hard-coded title cannot satisfy this
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card-title')).not.toHaveTextContent(
      getCoinName(LUHANSK.coin).title,
    );
  });

  it('links each card to its coin page', () => {
    renderAlbum();
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card-link')).toHaveAttribute(
      'href',
      '/catalog/coin-donetsk',
    );
    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card-link')).toHaveAttribute(
      'href',
      '/catalog/coin-luhansk',
    );
  });
});

describe('SetAlbum: owner states (criteria 7, 8, 17)', () => {
  it('marks owned and missing cards via data-state', () => {
    renderAlbum();
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card')).toHaveAttribute('data-state', 'owned');
    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card')).toHaveAttribute('data-state', 'missing');
  });

  it('flags key-date cards', () => {
    renderAlbum();
    expect(within(itemFor('coin-odesa')).getByTestId('coin-card')).toHaveAttribute('data-key-date', 'true');
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card')).toHaveAttribute('data-key-date', 'false');
  });

  it('gives each card a check toggle that names the action and reflects ownership', () => {
    renderAlbum();
    const owned = within(itemFor('coin-donetsk')).getByTestId('status-toggle');
    const missing = within(itemFor('coin-luhansk')).getByTestId('status-toggle');

    expect(owned).toHaveAttribute('aria-pressed', 'true');
    expect(owned).toHaveAttribute('aria-label', `Mark ${getCoinName(DONETSK.coin).title} as missing`);
    expect(missing).toHaveAttribute('aria-pressed', 'false');
    expect(missing).toHaveAttribute('aria-label', `Mark ${getCoinName(LUHANSK.coin).title} as owned`);
  });

  it('calls onToggle with the slot when the check is clicked', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();

    await user.click(within(itemFor('coin-luhansk')).getByTestId('status-toggle'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(LUHANSK);

    await user.click(within(itemFor('coin-donetsk')).getByTestId('status-toggle'));
    expect(onToggle).toHaveBeenLastCalledWith(DONETSK);
  });

  it('reflects statusFor per coin: pending, failed and idle', () => {
    renderAlbum({
      statusFor: (id) => (id === 'coin-luhansk' ? 'pending' : id === 'coin-odesa' ? 'failed' : 'idle'),
    });

    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card')).toHaveAttribute('data-status', 'pending');
    expect(within(itemFor('coin-odesa')).getByTestId('coin-card')).toHaveAttribute('data-status', 'failed');
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card')).toHaveAttribute('data-status', 'idle');
    expect(within(itemFor('coin-luhansk')).getByTestId('status-toggle')).toBeDisabled();
    expect(within(itemFor('coin-odesa')).getByTestId('coin-card-retry')).toBeInTheDocument();
    expect(within(itemFor('coin-donetsk')).queryByTestId('coin-card-retry')).not.toBeInTheDocument();
  });

  it('calls onToggle with the slot when the failed card Retry is clicked', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ statusFor: (id) => (id === 'coin-odesa' ? 'failed' : 'idle') });

    await user.click(within(itemFor('coin-odesa')).getByTestId('coin-card-retry'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(ODESA);
  });
});

describe('SetAlbum: visitor', () => {
  it('shows no check toggle and no status line for a visitor', () => {
    renderAlbum({ visitor: true });

    expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
    expect(screen.queryAllByTestId('coin-card-status')).toHaveLength(0);
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card')).toHaveAttribute('data-state', 'visitor');
  });

  it('still links cards to the coin page for a visitor', () => {
    renderAlbum({ visitor: true });
    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card-link')).toHaveAttribute(
      'href',
      '/catalog/coin-luhansk',
    );
  });
});

describe('SetAlbum: select mode (criterion 9)', () => {
  it('replaces the check and the link with a whole-card select button', () => {
    renderAlbum({ selectMode: true });

    expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
    expect(screen.queryAllByTestId('coin-card-link')).toHaveLength(0);
    expect(screen.getAllByTestId('coin-card-select')).toHaveLength(3);
  });

  it('calls onSelect with the coin id of the clicked card', async () => {
    const user = userEvent.setup();
    const { onSelect, onToggle } = renderAlbum({ selectMode: true });

    await user.click(within(itemFor('coin-luhansk')).getByTestId('coin-card-select'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('coin-luhansk');
    expect(onToggle).not.toHaveBeenCalled();

    await user.click(within(itemFor('coin-odesa')).getByTestId('coin-card-select'));
    expect(onSelect).toHaveBeenLastCalledWith('coin-odesa');
  });

  it('marks only the selected cards via data-selected and aria-pressed', () => {
    renderAlbum({ selectMode: true, selectedCoinIds: new Set(['coin-luhansk']) });

    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card')).toHaveAttribute('data-selected', 'true');
    expect(within(itemFor('coin-luhansk')).getByTestId('coin-card-select')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card')).toHaveAttribute('data-selected', 'false');
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card-select')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('gives selected cards the accent outline', () => {
    renderAlbum({ selectMode: true, selectedCoinIds: new Set(['coin-odesa']) });
    expect(within(itemFor('coin-odesa')).getByTestId('coin-card').className).toContain('outline-accent-700');
    expect(within(itemFor('coin-donetsk')).getByTestId('coin-card').className).not.toContain(
      'outline-accent-700',
    );
  });
});

describe('SetViewSwitch', () => {
  it('renders a labelled group with Album first, then List', () => {
    render(<SetViewSwitch view="album" onChange={vi.fn()} />);

    const group = screen.getByTestId('set-editor-view-switch');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-label', 'View');
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveTextContent('List');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveTextContent('Album');

    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
      'set-editor-view-album-toggle',
      'set-editor-view-list-toggle',
    ]);
  });

  it('keeps the accessible names Album and List', () => {
    render(<SetViewSwitch view="album" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Album' })).toBe(screen.getByTestId('set-editor-view-album-toggle'));
    expect(screen.getByRole('button', { name: 'List' })).toBe(screen.getByTestId('set-editor-view-list-toggle'));
  });

  it('hides the text label visually under 900px (sr-only) so each button is icon-only on mobile', () => {
    render(<SetViewSwitch view="album" onChange={vi.fn()} />);
    expect(screen.getByText('Album').className).toContain('max-[899px]:sr-only');
    expect(screen.getByText('List').className).toContain('max-[899px]:sr-only');
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
