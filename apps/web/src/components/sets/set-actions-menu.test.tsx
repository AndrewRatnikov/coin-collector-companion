/**
 * Tests for: SetActionsMenu (owner-only ⋯ menu)
 * Contract source: runs/run_20261011_095624/plan.md § Interface Contract → Component: SetActionsMenu
 * Extended by: runs/run_20261017_210503/plan.md § Interface Contract → Component: SetActionsMenu (MODIFY)
 *              runs/run_20261103_192441/plan.md § Interface Contract → Component: SetActionsMenu (MODIFY)
 * Covers criteria: #11 (run_20261011_095624); #14 (run_20261017_210503, mobile Select / Mark all items);
 *                  #1, #2, #4 (run_20261103_192441, Minimum grade select)
 *
 * jsdom loads no Tailwind, so the min-[900px]:hidden items are visible to tests at every width.
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('SetActionsMenu: mobile Select and Mark all items (criterion 14)', () => {
  it('renders neither item without the new props', async () => {
    renderMenu();
    await openMenu();
    expect(screen.queryByTestId('set-editor-select-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-editor-mark-all-item')).not.toBeInTheDocument();
  });

  it('renders Select coins and Mark all before Rename when both handlers are given', async () => {
    renderMenu({ onSelectCoins: vi.fn(), onMarkAllOwned: vi.fn(), markAllCount: 5 });
    await openMenu();

    const ids = screen.getAllByRole('menuitem').map((i) => i.getAttribute('data-testid'));
    expect(ids).toEqual([
      'set-editor-select-item',
      'set-editor-mark-all-item',
      'set-editor-rename-item',
      'set-editor-download-missing',
      'set-editor-print-missing',
      'set-editor-delete-button',
    ]);
    expect(screen.getByTestId('set-editor-select-item')).toHaveTextContent('Select coins');
  });

  it('renders only the Select item when only onSelectCoins is given', async () => {
    renderMenu({ onSelectCoins: vi.fn() });
    await openMenu();
    expect(screen.getByTestId('set-editor-select-item')).toBeInTheDocument();
    expect(screen.queryByTestId('set-editor-mark-all-item')).not.toBeInTheDocument();
  });

  it('renders only the Mark all item when only onMarkAllOwned is given', async () => {
    renderMenu({ onMarkAllOwned: vi.fn(), markAllCount: 2 });
    await openMenu();
    expect(screen.queryByTestId('set-editor-select-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-editor-mark-all-item')).toBeInTheDocument();
  });

  it('labels Mark all with the count, and uses the singular for one coin', async () => {
    const { unmount } = renderMenu({ onMarkAllOwned: vi.fn(), markAllCount: 12 });
    await openMenu();
    expect(screen.getByTestId('set-editor-mark-all-item')).toHaveTextContent('Mark all 12 as owned');
    unmount();

    renderMenu({ onMarkAllOwned: vi.fn(), markAllCount: 1 });
    await openMenu();
    expect(screen.getByTestId('set-editor-mark-all-item')).toHaveTextContent('Mark 1 as owned');
    expect(screen.getByTestId('set-editor-mark-all-item')).not.toHaveTextContent('Mark all');
  });

  it('hides both items on desktop with min-[900px]:hidden', async () => {
    renderMenu({ onSelectCoins: vi.fn(), onMarkAllOwned: vi.fn(), markAllCount: 3 });
    await openMenu();
    expect(screen.getByTestId('set-editor-select-item').className).toContain('min-[900px]:hidden');
    expect(screen.getByTestId('set-editor-mark-all-item').className).toContain('min-[900px]:hidden');
  });

  it('Select coins closes the menu and calls onSelectCoins once', async () => {
    const onSelectCoins = vi.fn();
    const { onRename } = renderMenu({ onSelectCoins });
    const user = await openMenu();

    await user.click(screen.getByTestId('set-editor-select-item'));

    expect(onSelectCoins).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('Mark all closes the menu and calls onMarkAllOwned once', async () => {
    const onMarkAllOwned = vi.fn();
    renderMenu({ onMarkAllOwned, markAllCount: 4 });
    const user = await openMenu();

    await user.click(screen.getByTestId('set-editor-mark-all-item'));

    expect(onMarkAllOwned).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
  });

  it('disables Mark all when markAllCount is 0 and does not call the handler', async () => {
    const onMarkAllOwned = vi.fn();
    renderMenu({ onMarkAllOwned, markAllCount: 0 });
    await openMenu();

    const item = screen.getByTestId('set-editor-mark-all-item');
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(onMarkAllOwned).not.toHaveBeenCalled();
  });

  it('enables Mark all when markAllCount is above 0', async () => {
    renderMenu({ onMarkAllOwned: vi.fn(), markAllCount: 1 });
    await openMenu();
    expect(screen.getByTestId('set-editor-mark-all-item')).toBeEnabled();
  });

  it('focuses Select coins first on open and arrow keys reach Rename', async () => {
    renderMenu({ onSelectCoins: vi.fn(), onMarkAllOwned: vi.fn(), markAllCount: 3 });
    const user = await openMenu();

    expect(screen.getByTestId('set-editor-select-item')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-mark-all-item')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });

  it('keyboard navigation skips a disabled Mark all', async () => {
    renderMenu({ onSelectCoins: vi.fn(), onMarkAllOwned: vi.fn(), markAllCount: 0 });
    const user = await openMenu();

    expect(screen.getByTestId('set-editor-select-item')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-rename-item')).toHaveFocus();
  });
});

describe('SetActionsMenu: Minimum grade select (run_20261103_192441 criteria 1, 2, 4)', () => {
  const GRADE_CODES = ['G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC'];

  it('renders neither the section nor the select without onMinGradeChange', async () => {
    renderMenu();
    await openMenu();

    expect(screen.queryByTestId('set-editor-min-grade')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-editor-min-grade-select')).not.toBeInTheDocument();
  });

  it('renders neither when only minGrade is given (the handler decides)', async () => {
    renderMenu({ minGrade: 'VF' });
    await openMenu();

    expect(screen.queryByTestId('set-editor-min-grade')).not.toBeInTheDocument();
  });

  it('renders a labelled group with a native select inside the menu when onMinGradeChange is given', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    const section = screen.getByTestId('set-editor-min-grade');
    expect(screen.getByTestId('set-editor-actions-menu')).toContainElement(section);
    expect(section).toHaveAttribute('role', 'group');
    const select = within(section).getByTestId('set-editor-min-grade-select');
    expect(select.tagName).toBe('SELECT');
    expect(within(section).getByText('Minimum grade')).toBeInTheDocument();
  });

  it('names the select "Minimum grade" through its visible label', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    expect(screen.getByRole('combobox', { name: 'Minimum grade' })).toBe(
      screen.getByTestId('set-editor-min-grade-select'),
    );
  });

  it('has exactly 8 options: None first, then the grade codes G to UNC as values', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    const options = within(screen.getByTestId('set-editor-min-grade-select')).getAllByRole('option');
    expect(options).toHaveLength(8);
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['', ...GRADE_CODES]);
    expect(options[0]).toHaveTextContent('None');
  });

  it('labels each grade option as "short · name" with the full name as its tooltip', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    const options = within(screen.getByTestId('set-editor-min-grade-select')).getAllByRole('option');
    expect(options[4]).toHaveTextContent('VF · Very Fine');
    expect(options[4]).toHaveAttribute('title', 'Very Fine');
    expect(options[7]).toHaveTextContent('UNC · Uncirculated');
    expect(options[7]).toHaveAttribute('title', 'Uncirculated');
    expect(options[1]).toHaveTextContent('G · Good');
  });

  it('shows None for a null minGrade and for an absent one', async () => {
    const { unmount } = renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveValue('');
    unmount();

    renderMenu({ onMinGradeChange: vi.fn() });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveValue('');
  });

  it('preselects the given minGrade (different grades give different values)', async () => {
    const { unmount } = renderMenu({ minGrade: 'VF', onMinGradeChange: vi.fn() });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveValue('VF');
    unmount();

    renderMenu({ minGrade: 'AU', onMinGradeChange: vi.fn() });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveValue('AU');
  });

  it('sits after Print missing list and before Delete in the menu', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    const section = screen.getByTestId('set-editor-min-grade');
    const print = screen.getByTestId('set-editor-print-missing');
    const del = screen.getByTestId('set-editor-delete-button');
    expect(print.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves the menuitems unchanged (the select is not a menuitem)', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    await openMenu();

    expect(screen.getAllByRole('menuitem').map((i) => i.getAttribute('data-testid'))).toEqual([
      'set-editor-rename-item',
      'set-editor-download-missing',
      'set-editor-print-missing',
      'set-editor-delete-button',
    ]);
  });

  it('calls onMinGradeChange once with the picked code', async () => {
    const onMinGradeChange = vi.fn();
    renderMenu({ minGrade: null, onMinGradeChange });
    const user = await openMenu();

    await user.selectOptions(screen.getByTestId('set-editor-min-grade-select'), 'VF');

    expect(onMinGradeChange).toHaveBeenCalledTimes(1);
    expect(onMinGradeChange).toHaveBeenCalledWith('VF');
  });

  it('passes the untranslated code for another pick', async () => {
    const onMinGradeChange = vi.fn();
    renderMenu({ minGrade: 'VF', onMinGradeChange });
    const user = await openMenu();

    await user.selectOptions(screen.getByTestId('set-editor-min-grade-select'), 'UNC');

    expect(onMinGradeChange).toHaveBeenCalledTimes(1);
    expect(onMinGradeChange).toHaveBeenCalledWith('UNC');
  });

  it('calls onMinGradeChange with null when None is picked', async () => {
    const onMinGradeChange = vi.fn();
    renderMenu({ minGrade: 'VF', onMinGradeChange });
    await openMenu();

    fireEvent.change(screen.getByTestId('set-editor-min-grade-select'), { target: { value: '' } });

    expect(onMinGradeChange).toHaveBeenCalledTimes(1);
    expect(onMinGradeChange).toHaveBeenCalledWith(null);
  });

  it('keeps the menu open after a change and runs no other action', async () => {
    const onMinGradeChange = vi.fn();
    const { onRename, onDelete, onDownloadMissing } = renderMenu({ minGrade: null, onMinGradeChange });
    const user = await openMenu();

    await user.selectOptions(screen.getByTestId('set-editor-min-grade-select'), 'F');

    expect(screen.getByTestId('set-editor-actions-menu')).toBeInTheDocument();
    expect(screen.getByTestId('set-editor-actions-trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onDownloadMissing).not.toHaveBeenCalled();
  });

  it('marks the select aria-busy only while minGradePending', async () => {
    const { unmount } = renderMenu({ minGrade: 'VF', onMinGradeChange: vi.fn(), minGradePending: true });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveAttribute('aria-busy', 'true');
    unmount();

    renderMenu({ minGrade: 'VF', onMinGradeChange: vi.fn(), minGradePending: false });
    await openMenu();
    expect(screen.getByTestId('set-editor-min-grade-select')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('is reachable with the arrow keys: ArrowDown from Print goes to the select, then Delete', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    const user = await openMenu();

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByTestId('set-editor-print-missing')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-min-grade-select')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('set-editor-delete-button')).toHaveFocus();
  });

  it('leaves arrow keys to the select once it has focus (menu focus does not move)', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    const user = await openMenu();
    const select = screen.getByTestId('set-editor-min-grade-select');

    select.focus();
    await user.keyboard('{ArrowDown}');

    expect(select).toHaveFocus();
    expect(screen.getByTestId('set-editor-actions-menu')).toBeInTheDocument();
  });

  it('closes on Escape from inside the select and returns focus to the trigger', async () => {
    renderMenu({ minGrade: null, onMinGradeChange: vi.fn() });
    const user = await openMenu();

    screen.getByTestId('set-editor-min-grade-select').focus();
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-editor-actions-trigger')).toHaveFocus();
  });
});
