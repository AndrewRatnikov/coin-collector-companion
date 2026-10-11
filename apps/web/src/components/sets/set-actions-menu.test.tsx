/**
 * Tests for: SetActionsMenu (owner-only ⋯ menu)
 * Contract source: runs/run_20261011_095624/plan.md § Interface Contract → Component: SetActionsMenu
 * Covers criteria: #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetActionsMenu } from '@/components/sets/set-actions-menu';

function renderMenu(over: Partial<React.ComponentProps<typeof SetActionsMenu>> = {}) {
  const handlers = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onDownloadMissing: vi.fn(),
  };
  const utils = render(
    <div>
      <SetActionsMenu printMissingHref="/sets/set-1/missing" nothingMissing={false} {...handlers} {...over} />
      <button type="button">outside</button>
    </div>,
  );
  return { ...utils, ...handlers };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('set-editor-actions-trigger'));
  return user;
}

describe('SetActionsMenu: trigger and items', () => {
  it('renders a closed trigger with menu semantics and a translated label', () => {
    renderMenu();
    const trigger = screen.getByTestId('set-editor-actions-trigger');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Set actions');
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('opens a menu with the four items in order, each a menuitem with tabindex -1', async () => {
    renderMenu();
    await openMenu();

    expect(screen.getByTestId('set-editor-actions-trigger')).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('set-editor-actions-menu');
    expect(menu).toHaveAttribute('role', 'menu');

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('data-testid'))).toEqual([
      'set-editor-rename-item',
      'set-editor-download-missing',
      'set-editor-print-missing',
      'set-editor-delete-button',
    ]);
    items.forEach((item) => expect(item).toHaveAttribute('tabindex', '-1'));
    expect(screen.getByTestId('set-editor-rename-item')).toHaveTextContent('Rename set');
    expect(screen.getByTestId('set-editor-download-missing')).toHaveTextContent('Download missing (CSV)');
    expect(screen.getByTestId('set-editor-print-missing')).toHaveTextContent('Print missing list');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveTextContent('Delete set');
  });

  it('colours the delete item with the danger token, not the old red', async () => {
    renderMenu();
    await openMenu();
    const del = screen.getByTestId('set-editor-delete-button');
    expect(del.className).toContain('text-danger');
    expect(del.className).not.toContain('text-red-700');
    expect(screen.getByTestId('set-editor-rename-item').className).not.toContain('text-danger');
  });

  it('links Print to the given href', async () => {
    renderMenu({ printMissingHref: '/sets/set-77/missing' });
    await openMenu();
    expect(screen.getByTestId('set-editor-print-missing')).toHaveAttribute('href', '/sets/set-77/missing');
  });
});

describe('SetActionsMenu: disabled states', () => {
  it('enables Download and Print when something is missing', async () => {
    renderMenu({ nothingMissing: false });
    await openMenu();
    expect(screen.getByTestId('set-editor-download-missing')).toBeEnabled();
    expect(screen.getByTestId('set-editor-print-missing')).not.toHaveAttribute('aria-disabled');
  });

  it('disables Download and aria-disables Print when nothing is missing, keeping Rename and Delete enabled', async () => {
    renderMenu({ nothingMissing: true });
    await openMenu();
    expect(screen.getByTestId('set-editor-download-missing')).toBeDisabled();
    expect(screen.getByTestId('set-editor-print-missing')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('set-editor-rename-item')).toBeEnabled();
    expect(screen.getByTestId('set-editor-delete-button')).toBeEnabled();
  });

  it('does not run Download when it is disabled, and prevents the Print navigation', async () => {
    const { onDownloadMissing } = renderMenu({ nothingMissing: true });
    await openMenu();

    fireEvent.click(screen.getByTestId('set-editor-download-missing'));
    expect(onDownloadMissing).not.toHaveBeenCalled();

    // fireEvent returns false when preventDefault was called
    expect(fireEvent.click(screen.getByTestId('set-editor-print-missing'))).toBe(false);
  });
});

describe('SetActionsMenu: actions and closing', () => {
  it('Rename closes the menu and calls onRename once', async () => {
    const { onRename, onDelete } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('set-editor-rename-item'));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('Delete closes the menu and calls onDelete once', async () => {
    const { onRename, onDelete } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('set-editor-delete-button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('Download closes the menu and calls onDownloadMissing once', async () => {
    const { onDownloadMissing } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByTestId('set-editor-download-missing'));

    expect(onDownloadMissing).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('clicking the trigger again closes the menu', async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByTestId('set-editor-actions-trigger'));
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-editor-actions-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside mousedown without running any action', async () => {
    const { onRename, onDelete, onDownloadMissing } = renderMenu();
    const user = await openMenu();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onDownloadMissing).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-editor-actions-trigger')).toHaveFocus();
  });

  it('closes on Tab', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{Tab}');

    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });
});

describe('SetActionsMenu: keyboard navigation', () => {
  it('moves focus to the first enabled item (Rename) when the menu opens', async () => {
    renderMenu();
    await openMenu();
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });

  it('ArrowDown walks Rename, Download, Print, Delete and wraps to Rename', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-download-missing')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-print-missing')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });

  it('ArrowUp goes backwards and wraps from Rename to Delete', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('set-editor-print-missing')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('set-editor-download-missing')).toHaveFocus();
  });

  it('Home and End jump to the first and last items', async () => {
    renderMenu();
    const user = await openMenu();

    await user.keyboard('{End}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });

  it('skips the disabled Download and Print when nothing is missing', async () => {
    renderMenu({ nothingMissing: true });
    const user = await openMenu();

    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
  });

  it('End and Home also skip disabled items', async () => {
    renderMenu({ nothingMissing: true });
    const user = await openMenu();

    await user.keyboard('{End}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });

  it('Enter on the focused item runs its action', async () => {
    const { onDownloadMissing } = renderMenu();
    const user = await openMenu();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onDownloadMissing).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });
});
