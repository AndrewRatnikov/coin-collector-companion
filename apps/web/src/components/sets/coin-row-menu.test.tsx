/**
 * Tests for: CoinRowMenu (the ⋯ menu on a list row)
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Component: CoinRowMenu
 * Covers criteria: #12
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinRowMenu } from '@/components/sets/coin-row-menu';

const OTHER_SETS = [
  { id: 'set-2', name: 'Lincoln Cents' },
  { id: 'set-3', name: 'Ukraine Circulation' },
];

function renderMenu(over: Partial<React.ComponentProps<typeof CoinRowMenu>> = {}) {
  const handlers = { onRemove: vi.fn(), onAddToSet: vi.fn() };
  const utils = render(
    <div>
      <CoinRowMenu coinId="coin-42" coinTitle="Odesa Oblast" otherSets={OTHER_SETS} {...handlers} {...over} />
      <button type="button">outside</button>
    </div>,
  );
  return { ...utils, ...handlers };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('coin-row-menu-trigger'));
  return user;
}

function isDisabled(el: HTMLElement) {
  return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
}

describe('CoinRowMenu: trigger', () => {
  it('is a closed button with menu semantics and a label that names the coin', () => {
    renderMenu();
    const trigger = screen.getByTestId('coin-row-menu-trigger');

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'More actions for Odesa Oblast');
    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
  });

  it('uses the given coin title in its label', () => {
    renderMenu({ coinTitle: 'Kyiv Oblast' });
    expect(screen.getByTestId('coin-row-menu-trigger')).toHaveAttribute('aria-label', 'More actions for Kyiv Oblast');
  });

  it('is at least 44px square', () => {
    renderMenu();
    const cls = screen.getByTestId('coin-row-menu-trigger').className;
    expect(cls).toMatch(/size-11|h-11/);
    expect(cls).toMatch(/size-11|w-11/);
  });

  it('opens a role=menu and reports expanded', async () => {
    renderMenu();
    await openMenu();

    expect(screen.getByTestId('coin-row-menu')).toHaveAttribute('role', 'menu');
    expect(screen.getByTestId('coin-row-menu-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking the trigger again closes the menu', async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('coin-row-menu-trigger'));

    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-row-menu-trigger')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CoinRowMenu: main panel', () => {
  it('lists Open coin page, Add to another set and Remove from set, in that order, as menuitems', async () => {
    renderMenu();
    await openMenu();

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('data-testid'))).toEqual([
      'coin-row-menu-open',
      'coin-row-menu-add-to-set',
      'coin-row-menu-remove',
    ]);
    expect(screen.getByTestId('coin-row-menu-open')).toHaveTextContent('Open coin page');
    expect(screen.getByTestId('coin-row-menu-add-to-set')).toHaveTextContent('Add to another set…');
    expect(screen.getByTestId('coin-row-menu-remove')).toHaveTextContent('Remove from set');
  });

  it('links Open coin page to the coin page of this coin', async () => {
    renderMenu({ coinId: 'coin-77' });
    await openMenu();
    expect(screen.getByTestId('coin-row-menu-open')).toHaveAttribute('href', '/catalog/coin-77');
  });

  it('styles Remove with the danger token and not the other items', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByTestId('coin-row-menu-remove').className).toContain('text-danger');
    expect(screen.getByTestId('coin-row-menu-open').className).not.toContain('text-danger');
    expect(screen.getByTestId('coin-row-menu-add-to-set').className).not.toContain('text-danger');
  });

  it('Remove calls onRemove once and closes the menu, without a dialog', async () => {
    const { onRemove, onAddToSet } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('coin-row-menu-remove'));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onAddToSet).not.toHaveBeenCalled();
    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CoinRowMenu: Add to another set panel', () => {
  it('switches to a sets panel: Back plus one item per other set with its name', async () => {
    renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    expect(screen.getByTestId('coin-row-menu')).toBeInTheDocument();
    expect(screen.getByTestId('coin-row-menu-back')).toHaveTextContent('‹ Back');
    const setItems = screen.getAllByTestId('coin-row-menu-set-item');
    expect(setItems.map((i) => i.textContent)).toEqual(['Lincoln Cents', 'Ukraine Circulation']);
    setItems.forEach((item) => expect(item).toHaveAttribute('role', 'menuitem'));
    expect(screen.queryByTestId('coin-row-menu-remove')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-row-menu-open')).not.toBeInTheDocument();
  });

  it('shows the sets it is given (different input, different items)', async () => {
    renderMenu({ otherSets: [{ id: 'set-9', name: 'Only One' }] });
    const user = await openMenu();

    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    expect(screen.getAllByTestId('coin-row-menu-set-item').map((i) => i.textContent)).toEqual(['Only One']);
  });

  it('clicking a set calls onAddToSet with that set id and closes the menu', async () => {
    const { onAddToSet, onRemove } = renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    await user.click(screen.getAllByTestId('coin-row-menu-set-item')[1]);

    expect(onAddToSet).toHaveBeenCalledTimes(1);
    expect(onAddToSet).toHaveBeenCalledWith('set-3');
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
  });

  it('calls onAddToSet with the first set for the first item', async () => {
    const { onAddToSet } = renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    await user.click(screen.getAllByTestId('coin-row-menu-set-item')[0]);

    expect(onAddToSet).toHaveBeenCalledWith('set-2');
  });

  it('Back returns to the main panel without calling anything', async () => {
    const { onAddToSet, onRemove } = renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    await user.click(screen.getByTestId('coin-row-menu-back'));

    expect(screen.getByTestId('coin-row-menu-open')).toBeInTheDocument();
    expect(screen.getByTestId('coin-row-menu-remove')).toBeInTheDocument();
    expect(screen.queryByTestId('coin-row-menu-set-item')).not.toBeInTheDocument();
    expect(onAddToSet).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows a disabled "You have no other sets." item when there are none', async () => {
    renderMenu({ otherSets: [] });
    const user = await openMenu();

    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));

    const empty = screen.getByTestId('coin-row-menu-no-sets');
    expect(empty).toHaveTextContent('You have no other sets.');
    expect(isDisabled(empty)).toBe(true);
    expect(screen.queryByTestId('coin-row-menu-set-item')).not.toBeInTheDocument();
  });

  it('does not show the empty item when there are other sets', async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('coin-row-menu-add-to-set'));
    expect(screen.queryByTestId('coin-row-menu-no-sets')).not.toBeInTheDocument();
  });
});

describe('CoinRowMenu: keyboard and closing', () => {
  it('focuses the first item when it opens', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByTestId('coin-row-menu-open')).toHaveFocus();
  });

  it('ArrowDown walks the items and wraps to the first', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('coin-row-menu-add-to-set')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('coin-row-menu-remove')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('coin-row-menu-open')).toHaveFocus();
  });

  it('ArrowUp wraps from the first item to the last', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('coin-row-menu-remove')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('coin-row-menu-add-to-set')).toHaveFocus();
  });

  it('Home and End jump to the first and last items', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{End}');
    expect(screen.getByTestId('coin-row-menu-remove')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('coin-row-menu-open')).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-row-menu-trigger')).toHaveFocus();
  });

  it('Tab closes the menu', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Tab}');

    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
  });

  it('closes on an outside mousedown without running any action', async () => {
    const { onRemove, onAddToSet } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onAddToSet).not.toHaveBeenCalled();
  });

  it('Enter on the focused Remove item runs onRemove', async () => {
    const { onRemove } = renderMenu();
    const user = await openMenu();

    await user.keyboard('{End}');
    await user.keyboard('{Enter}');

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('coin-row-menu')).not.toBeInTheDocument();
  });
});
