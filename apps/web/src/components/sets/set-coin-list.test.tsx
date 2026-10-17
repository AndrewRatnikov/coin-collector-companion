/**
 * Tests for: SetCoinList (list rows for one year group)
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Component: SetCoinList
 * Covers criteria: #11, #12, #14
 *
 * Expected text is computed with getCoinName and formatCollectorNotation, so the formatter is not
 * hard-coded here.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoinName, type GapSlot } from '@coin-collector/shared';
import { formatCollectorNotation } from '@/lib/album-layout';
import { SetCoinList } from '@/components/sets/set-coin-list';

function slot(
  position: number,
  id: string,
  over: { year?: number; mintMark?: string; variety?: string; owned?: boolean; name?: string },
): GapSlot {
  return {
    id: `usc-${id}`,
    position,
    owned: over.owned ?? false,
    coin: {
      id: `coin-${id}`,
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      year: over.year ?? 2025,
      mintMark: over.mintMark ?? '',
      variety: over.variety ?? '',
      name: over.name ?? 'Ukraine Commemorative 10 Hryvnias',
      imageUrl: null,
      imageSource: null,
      imageLicense: null,
      diameterMm: null,
      weightG: null,
      thicknessMm: null,
      material: null,
      mintage: null,
      isKeyDate: false,
      status: 'approved',
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

const DONETSK = slot(0, 'donetsk', {
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  owned: true,
});
const LUHANSK = slot(1, 'luhansk', {
  variety: 'We Are Strong. We Are Together: Luhansk Oblast',
  owned: false,
});
// plain coin: no variety, so title is the type name or denomination and the eyebrow is empty
const PLAIN = slot(2, 'plain', {
  year: 1992,
  mintMark: 'S',
  variety: '',
  name: 'Ukraine 25 Kopiyok',
  owned: false,
});

const OTHER_SETS = [
  { id: 'set-2', name: 'Lincoln Cents' },
  { id: 'set-3', name: 'Ukraine Circulation' },
];

function renderList(over: Partial<React.ComponentProps<typeof SetCoinList>> = {}) {
  const props = {
    slots: [DONETSK, LUHANSK, PLAIN],
    visitor: false,
    statusFor: () => 'idle' as const,
    onToggle: vi.fn(),
    otherSets: OTHER_SETS,
    onRemove: vi.fn(),
    onAddToSet: vi.fn(),
    ...over,
  };
  const utils = render(<SetCoinList {...props} />);
  return { ...utils, onToggle: props.onToggle, onRemove: props.onRemove, onAddToSet: props.onAddToSet };
}

function rowFor(coinId: string) {
  const row = screen.getAllByTestId('set-coin-row').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!row) throw new Error(`no row for ${coinId}`);
  return row;
}

describe('SetCoinList: structure (criterion 11)', () => {
  it('renders a table root, an aria-hidden head row and one row per slot in the given order', () => {
    renderList();

    expect(screen.getByTestId('set-coin-list')).toBeInTheDocument();
    expect(screen.getByTestId('set-coin-list-head')).toHaveAttribute('aria-hidden', 'true');
    const rows = screen.getAllByTestId('set-coin-row');
    expect(rows.map((r) => r.getAttribute('data-coin-id'))).toEqual(['coin-donetsk', 'coin-luhansk', 'coin-plain']);
  });

  it('keeps the order it is given', () => {
    renderList({ slots: [PLAIN, DONETSK] });
    expect(screen.getAllByTestId('set-coin-row').map((r) => r.getAttribute('data-coin-id'))).toEqual([
      'coin-plain',
      'coin-donetsk',
    ]);
  });

  it('labels the head row columns Coin, Year and Status', () => {
    renderList();
    const head = screen.getByTestId('set-coin-list-head');
    expect(head).toHaveTextContent('Coin');
    expect(head).toHaveTextContent('Year');
    expect(head).toHaveTextContent('Status');
  });

  it('renders no rows for no slots', () => {
    renderList({ slots: [] });
    expect(screen.queryAllByTestId('set-coin-row')).toHaveLength(0);
  });
});

describe('SetCoinList: name block and year (criteria 7, 11)', () => {
  it('shows the getCoinName title and subtitle of each coin', () => {
    renderList();

    for (const s of [DONETSK, LUHANSK, PLAIN]) {
      const name = getCoinName(s.coin);
      const row = within(rowFor(s.coin.id));
      expect(row.getByTestId('set-coin-row-title')).toHaveTextContent(name.title);
      expect(row.getByTestId('set-coin-row-subtitle')).toHaveTextContent(name.subtitle);
    }
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-title')).not.toHaveTextContent(
      getCoinName(LUHANSK.coin).title,
    );
  });

  it('shows the eyebrow only when getCoinName gives a non-empty one', () => {
    renderList();

    const donetskName = getCoinName(DONETSK.coin);
    expect(donetskName.eyebrow).not.toBe('');
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-eyebrow')).toHaveTextContent(donetskName.eyebrow);

    const plainName = getCoinName(PLAIN.coin);
    if (plainName.eyebrow === '') {
      expect(within(rowFor('coin-plain')).queryByTestId('set-coin-row-eyebrow')).not.toBeInTheDocument();
    } else {
      expect(within(rowFor('coin-plain')).getByTestId('set-coin-row-eyebrow')).toHaveTextContent(plainName.eyebrow);
    }
  });

  it('links each row to its coin page, with the title inside the link', () => {
    renderList();

    const link = within(rowFor('coin-luhansk')).getByTestId('set-coin-row-link');
    expect(link).toHaveAttribute('href', '/catalog/coin-luhansk');
    expect(within(link).getByTestId('set-coin-row-title')).toHaveTextContent(getCoinName(LUHANSK.coin).title);
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-link')).toHaveAttribute(
      'href',
      '/catalog/coin-donetsk',
    );
  });

  it('shows the collector notation in the year cell, with the mint mark when there is one', () => {
    renderList();

    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-year')).toHaveTextContent(
      formatCollectorNotation(DONETSK.coin),
    );
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-year').textContent).toBe('2025');
    expect(within(rowFor('coin-plain')).getByTestId('set-coin-row-year').textContent).toBe('1992-S');
  });
});

describe('SetCoinList: owner status toggle (criterion 11, 14)', () => {
  it('gives every owner row a pill toggle reflecting ownership', () => {
    renderList();

    const owned = within(rowFor('coin-donetsk')).getByTestId('status-toggle');
    const missing = within(rowFor('coin-luhansk')).getByTestId('status-toggle');
    expect(owned).toHaveAttribute('data-variant', 'pill');
    expect(owned).toHaveAttribute('aria-pressed', 'true');
    expect(owned).toHaveTextContent('Owned');
    expect(missing).toHaveAttribute('data-variant', 'pill');
    expect(missing).toHaveAttribute('aria-pressed', 'false');
    expect(missing).toHaveTextContent('Missing');
  });

  it('collapses the pill label to the disc under 900px', () => {
    renderList();
    expect(within(rowFor('coin-luhansk')).getByText('Missing').className).toContain('max-[899px]:sr-only');
  });

  it('calls onToggle with the slot when the pill is clicked', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderList();

    await user.click(within(rowFor('coin-luhansk')).getByTestId('status-toggle'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(LUHANSK);

    await user.click(within(rowFor('coin-donetsk')).getByTestId('status-toggle'));
    expect(onToggle).toHaveBeenLastCalledWith(DONETSK);
  });

  it('shows data-status per row from statusFor', () => {
    renderList({
      statusFor: (id) => (id === 'coin-luhansk' ? 'pending' : id === 'coin-plain' ? 'failed' : 'idle'),
    });

    expect(rowFor('coin-donetsk')).toHaveAttribute('data-status', 'idle');
    expect(rowFor('coin-luhansk')).toHaveAttribute('data-status', 'pending');
    expect(rowFor('coin-plain')).toHaveAttribute('data-status', 'failed');
  });

  it('disables and marks busy the pill of a pending row only', () => {
    renderList({ statusFor: (id) => (id === 'coin-luhansk' ? 'pending' : 'idle') });

    const pending = within(rowFor('coin-luhansk')).getByTestId('status-toggle');
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute('aria-busy', 'true');
    expect(within(rowFor('coin-donetsk')).getByTestId('status-toggle')).toBeEnabled();
  });
});

describe('SetCoinList: failed row (criterion 11)', () => {
  it('tints the row and replaces the subtitle with the save-failed message', () => {
    renderList({ statusFor: (id) => (id === 'coin-luhansk' ? 'failed' : 'idle') });

    const failedRow = rowFor('coin-luhansk');
    expect(failedRow.className).toContain('bg-danger-bg');
    const subtitle = within(failedRow).getByTestId('set-coin-row-subtitle');
    expect(subtitle.textContent).toMatch(/^Couldn.t save\. Check your connection\.$/);
    expect(subtitle.className).toContain('text-danger');
    expect(subtitle.textContent).not.toBe(getCoinName(LUHANSK.coin).subtitle);
  });

  it('leaves idle rows untinted with their normal subtitle', () => {
    renderList({ statusFor: (id) => (id === 'coin-luhansk' ? 'failed' : 'idle') });

    const okRow = rowFor('coin-donetsk');
    expect(okRow.className).not.toContain('bg-danger-bg');
    expect(within(okRow).getByTestId('set-coin-row-subtitle')).toHaveTextContent(getCoinName(DONETSK.coin).subtitle);
  });

  it('retries from the failed pill through onToggle', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderList({ statusFor: (id) => (id === 'coin-luhansk' ? 'failed' : 'idle') });

    const pill = within(rowFor('coin-luhansk')).getByTestId('status-toggle');
    expect(pill).toHaveTextContent('Retry');
    await user.click(pill);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(LUHANSK);
  });
});

describe('SetCoinList: row menu (criterion 12)', () => {
  it('gives every owner row its own ⋯ trigger naming the coin', () => {
    renderList();

    const triggers = screen.getAllByTestId('coin-row-menu-trigger');
    expect(triggers).toHaveLength(3);
    expect(within(rowFor('coin-luhansk')).getByTestId('coin-row-menu-trigger')).toHaveAttribute(
      'aria-label',
      `More actions for ${getCoinName(LUHANSK.coin).title}`,
    );
  });

  it('Open coin page in a row menu links to that coin', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(within(rowFor('coin-plain')).getByTestId('coin-row-menu-trigger'));

    expect(screen.getByTestId('coin-row-menu-open')).toHaveAttribute('href', '/catalog/coin-plain');
  });

  it('Remove calls onRemove with that row slot', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderList();

    await user.click(within(rowFor('coin-luhansk')).getByTestId('coin-row-menu-trigger'));
    await user.click(screen.getByTestId('coin-row-menu-remove'));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(LUHANSK);
  });

  it('adding to another set calls onAddToSet with the slot and the chosen set id', async () => {
    const user = userEvent.setup();
    const { onAddToSet } = renderList();

    await user.click(within(rowFor('coin-donetsk')).getByTestId('coin-row-menu-trigger'));
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));
    await user.click(screen.getAllByTestId('coin-row-menu-set-item')[1]);

    expect(onAddToSet).toHaveBeenCalledTimes(1);
    expect(onAddToSet).toHaveBeenCalledWith(DONETSK, 'set-3');
  });

  it('passes the other sets through to the menu', async () => {
    const user = userEvent.setup();
    renderList({ otherSets: [{ id: 'only', name: 'Only One' }] });

    await user.click(within(rowFor('coin-donetsk')).getByTestId('coin-row-menu-trigger'));
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    expect(screen.getAllByTestId('coin-row-menu-set-item').map((i) => i.textContent)).toEqual(['Only One']);
  });
});

describe('SetCoinList: visitor', () => {
  it('shows no toggle and no menu, but keeps rows, names and links', () => {
    renderList({ visitor: true });

    expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
    expect(screen.queryAllByTestId('coin-row-menu-trigger')).toHaveLength(0);
    expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-link')).toHaveAttribute(
      'href',
      '/catalog/coin-donetsk',
    );
    expect(within(rowFor('coin-donetsk')).getByTestId('set-coin-row-title')).toHaveTextContent(
      getCoinName(DONETSK.coin).title,
    );
  });
});
