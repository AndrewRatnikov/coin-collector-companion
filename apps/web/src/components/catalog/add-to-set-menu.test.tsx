/**
 * Tests for: AddToSetMenu
 * Contract source: runs/run_20261019_205931/plan.md § Interface Contract → Component: AddToSetMenu
 * Covers criteria: #10, #11, #7 (44px items)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToSetMenu, type AddToSetMenuSet } from '@/components/catalog/add-to-set-menu';

const SETS: AddToSetMenuSet[] = [
  { id: 'set-a', name: 'Wheat Cents', status: 'available' },
  { id: 'set-b', name: 'Key Dates', status: 'added' },
  { id: 'set-c', name: 'Busy Set', status: 'adding' },
  { id: 'set-d', name: 'Still Loading', status: 'loading' },
];

function renderMenu(sets: AddToSetMenuSet[] = SETS) {
  const onAdd = vi.fn();
  const utils = render(
    <div>
      <AddToSetMenu coinTitle="Type 2" sets={sets} onAdd={onAdd} />
      <button type="button">outside</button>
    </div>,
  );
  return { ...utils, onAdd };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('coin-detail-add-to-set'));
  return user;
}

describe('AddToSetMenu: trigger', () => {
  it('is a closed menu button labelled Add to a set…', () => {
    renderMenu();
    const trigger = screen.getByTestId('coin-detail-add-to-set');

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('Add to a set…');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('coin-detail-add-to-set-menu')).not.toBeInTheDocument();
  });

  it('opens a role=menu and reports expanded', async () => {
    renderMenu();
    await openMenu();

    expect(screen.getByTestId('coin-detail-add-to-set-menu')).toHaveAttribute('role', 'menu');
    expect(screen.getByTestId('coin-detail-add-to-set')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the coin title in the menu header', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByTestId('coin-detail-add-to-set-menu')).toHaveTextContent('Add Type 2 to…');
  });
});

describe('AddToSetMenu: items', () => {
  it('renders one menuitemcheckbox per set with name, mark and aria state', async () => {
    renderMenu();
    await openMenu();

    const items = screen.getAllByTestId('coin-detail-add-to-set-item');
    expect(items).toHaveLength(4);
    items.forEach((item) => expect(item).toHaveAttribute('role', 'menuitemcheckbox'));
    expect(items.map((i) => i.getAttribute('data-set-id'))).toEqual(['set-a', 'set-b', 'set-c', 'set-d']);

    expect(items[0]).toHaveTextContent('Wheat Cents');
    expect(items[0]).toHaveTextContent('Add');
    expect(items[0]).toHaveAttribute('aria-checked', 'false');
    expect(items[0]).not.toHaveAttribute('aria-disabled', 'true');

    expect(items[1]).toHaveTextContent('Key Dates');
    expect(items[1]).toHaveTextContent('✓ Added');
    expect(items[1]).toHaveAttribute('aria-checked', 'true');
    expect(items[1]).toHaveAttribute('aria-disabled', 'true');

    expect(items[2]).toHaveTextContent('Adding…');
    expect(items[2]).toHaveAttribute('aria-checked', 'false');
    expect(items[2]).toHaveAttribute('aria-disabled', 'true');

    expect(items[3]).toHaveTextContent('Add');
    expect(items[3]).toHaveAttribute('aria-checked', 'false');
    expect(items[3]).toHaveAttribute('aria-disabled', 'true');
  });

  it('items are at least 44px tall', async () => {
    renderMenu();
    await openMenu();
    screen.getAllByTestId('coin-detail-add-to-set-item').forEach((item) => {
      expect(item.className).toMatch(/min-h-11|h-11/);
    });
  });

  it('ends with a New set with this coin menuitem link to /sets/new', async () => {
    renderMenu();
    await openMenu();

    const link = screen.getByTestId('coin-detail-add-to-set-new');
    expect(link).toHaveAttribute('role', 'menuitem');
    expect(link).toHaveAttribute('href', '/sets/new');
    expect(link).toHaveTextContent('New set with this coin');
  });

  it('shows only the new-set link when there are no sets', async () => {
    renderMenu([]);
    await openMenu();
    expect(screen.queryByTestId('coin-detail-add-to-set-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-add-to-set-new')).toBeInTheDocument();
  });
});

describe('AddToSetMenu: adding', () => {
  it('clicking an available item calls onAdd once with its id and leaves the menu open', async () => {
    const { onAdd } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[0]);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('set-a');
    expect(screen.getByTestId('coin-detail-add-to-set-menu')).toBeInTheDocument();
  });

  it('passes the id of whichever available item was clicked', async () => {
    const { onAdd } = renderMenu([
      { id: 'set-x', name: 'X', status: 'available' },
      { id: 'set-y', name: 'Y', status: 'available' },
    ]);
    const user = await openMenu();

    await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[1]);

    expect(onAdd).toHaveBeenCalledWith('set-y');
  });

  it('inert items (added, adding, loading) never call onAdd', async () => {
    const { onAdd } = renderMenu();
    const user = await openMenu();
    const items = screen.getAllByTestId('coin-detail-add-to-set-item');

    await user.click(items[1]);
    await user.click(items[2]);
    await user.click(items[3]);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('coin-detail-add-to-set-menu')).toBeInTheDocument();
  });

  it('the new-set link closes the menu', async () => {
    const { onAdd } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('coin-detail-add-to-set-new'));

    expect(screen.queryByTestId('coin-detail-add-to-set-menu')).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('AddToSetMenu: keyboard and closing', () => {
  it('focuses the first item on open', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getAllByTestId('coin-detail-add-to-set-item')[0]).toHaveFocus();
  });

  it('focuses the new-set link on open when there are no sets', async () => {
    renderMenu([]);
    await openMenu();
    expect(screen.getByTestId('coin-detail-add-to-set-new')).toHaveFocus();
  });

  it('ArrowDown walks every item including inert ones and the link, then wraps', async () => {
    renderMenu();
    const user = await openMenu();
    const items = screen.getAllByTestId('coin-detail-add-to-set-item');

    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[2]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[3]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('coin-detail-add-to-set-new')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[0]).toHaveFocus();
  });

  it('ArrowUp wraps from the first item to the new-set link', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('coin-detail-add-to-set-new')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByTestId('coin-detail-add-to-set-item')[3]).toHaveFocus();
  });

  it('Home and End jump to the first and last items', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{End}');
    expect(screen.getByTestId('coin-detail-add-to-set-new')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getAllByTestId('coin-detail-add-to-set-item')[0]).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('coin-detail-add-to-set-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-add-to-set')).toHaveFocus();
  });

  it('Tab closes the menu', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Tab}');

    expect(screen.queryByTestId('coin-detail-add-to-set-menu')).not.toBeInTheDocument();
  });

  it('closes on an outside mousedown without calling onAdd', async () => {
    const { onAdd } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByTestId('coin-detail-add-to-set-menu')).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('Enter on the focused available item calls onAdd', async () => {
    const { onAdd } = renderMenu();
    await openMenu();

    await userEvent.keyboard('{Enter}');

    expect(onAdd).toHaveBeenCalledWith('set-a');
  });
});
