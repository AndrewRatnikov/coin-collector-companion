/**
 * Tests for: ConfirmDialog (default + danger variant)
 * Contract source: runs/run_20261011_095624/plan.md § Interface Contract → Component: ConfirmDialog
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      title="Delete this set?"
      description="This action cannot be undone."
      confirmLabel="Delete set"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testIdPrefix="confirm-dialog"
      {...overrides}
    />,
  );
  return { ...utils, onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('renders the title and description when open', () => {
    renderDialog();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete this set?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByTestId('confirm-dialog-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the overlay is clicked', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(screen.getByTestId('confirm-dialog-overlay'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog: variants', () => {
  it('defaults to the default variant and keeps its look', () => {
    renderDialog();
    const panel = screen.getByTestId('confirm-dialog-panel');
    expect(panel).toHaveAttribute('data-variant', 'default');
    expect(panel).toHaveAttribute('role', 'alertdialog');
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel).toHaveAttribute('aria-label', 'Delete this set?');
    expect(screen.getByTestId('confirm-dialog-confirm').className).not.toContain('bg-danger');
    // default description stays a paragraph
    expect(screen.getByText('This action cannot be undone.').tagName).toBe('P');
  });

  it('marks an explicit default variant the same way', () => {
    renderDialog({ variant: 'default' });
    expect(screen.getByTestId('confirm-dialog-panel')).toHaveAttribute('data-variant', 'default');
  });

  it('danger variant marks the panel and keeps the alertdialog semantics', () => {
    renderDialog({ variant: 'danger' });
    const panel = screen.getByTestId('confirm-dialog-panel');
    expect(panel).toHaveAttribute('data-variant', 'danger');
    expect(panel).toHaveAttribute('role', 'alertdialog');
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel).toHaveAttribute('aria-label', 'Delete this set?');
  });

  it('danger variant styles the confirm button with the danger token and white text', () => {
    renderDialog({ variant: 'danger' });
    const confirm = screen.getByTestId('confirm-dialog-confirm');
    expect(confirm.className).toContain('bg-danger');
    expect(confirm.className).toContain('text-white');
    expect(screen.getByTestId('confirm-dialog-cancel').className).not.toContain('bg-danger');
  });

  it('danger variant does not render the description inside a paragraph, so block content is valid', () => {
    renderDialog({
      variant: 'danger',
      description: (
        <>
          <span>Body copy.</span>
          <p>Reassurance note.</p>
        </>
      ),
    });
    expect(screen.getByText('Body copy.').closest('p')).toBeNull();
    expect(screen.getByText('Reassurance note.')).toBeInTheDocument();
  });

  it('danger variant uses the same test ids and callbacks', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog({ variant: 'danger', testIdPrefix: 'set-editor-delete-confirm' });

    expect(screen.getByTestId('set-editor-delete-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('set-editor-delete-confirm-overlay')).toBeInTheDocument();

    await user.click(screen.getByTestId('set-editor-delete-confirm-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('set-editor-delete-confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('set-editor-delete-confirm-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(2);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('danger variant still renders nothing when closed', () => {
    renderDialog({ variant: 'danger', open: false });
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
