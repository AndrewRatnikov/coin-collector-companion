/**
 * Tests for: AdminSubmissionsPage and SubmissionReviewItem
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Page: AdminSubmissionsPage (CREATE),
 *                  Component: SubmissionReviewItem (CREATE)
 * Covers criteria: #16, #17, #18, #19, #20, #24 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Approach: a real QueryClientProvider (retry disabled) with `fetch` stubbed by a small in-memory
 * "backend" (GET /admin/coins returns the current list, PATCH /admin/coins/:id records the body and,
 * on success, removes the coin), so "the coin leaves the list after approve/reject" is exercised
 * through the real hooks, including the invalidation and refetch. fetch is stubbed with
 * vi.stubGlobal rather than vi.mock(), the same pattern the lib tests use.
 * Edited input values are replaced with fireEvent.change (user.clear + user.type appends on
 * pre-filled controlled inputs, see the repo's web rules).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSubmissionsPage from '@/app/admin/submissions/page';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

type Item = Record<string, unknown>;

function makeItem(overrides: Item = {}): Item {
  return {
    id: 'coin-1',
    country: 'USA',
    denomination: '1 Cent',
    name: 'Lincoln Wheat Cent',
    year: 1943,
    mintMark: 'D',
    variety: 'Steel',
    status: 'pending',
    rejectionReason: null,
    submitterEmail: 'submitter@example.com',
    possibleDuplicate: null,
    ...overrides,
  };
}

interface Backend {
  items: Item[];
  getStatus: number;
  getBody?: unknown;
  patchStatus: number;
  patchBody?: unknown;
  patchGate?: Promise<void>;
  patches: Array<{ url: string; method: string; body: Record<string, unknown> }>;
}

let backend: Backend;

function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function installBackend(overrides: Partial<Backend> = {}) {
  backend = { items: [], getStatus: 200, patchStatus: 200, patches: [], ...overrides };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      backend.patches.push({
        url,
        method: 'PATCH',
        body: JSON.parse(init.body as string) as Record<string, unknown>,
      });
      if (backend.patchGate) await backend.patchGate;
      if (backend.patchStatus === 200) {
        const id = url.split('/').pop();
        backend.items = backend.items.filter((i) => i.id !== id);
        return respond(200, backend.patchBody ?? { id, status: 'approved' });
      }
      return respond(backend.patchStatus, backend.patchBody ?? { message: 'error' });
    }
    if (backend.getStatus !== 200) {
      return respond(backend.getStatus, backend.getBody ?? { message: 'error' });
    }
    return respond(200, { items: backend.items, page: 1, limit: 50, total: backend.items.length });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminSubmissionsPage />
    </QueryClientProvider>,
  );
}

async function findItems() {
  return screen.findAllByTestId('admin-submission-item');
}

describe('AdminSubmissionsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    setStoredToken('tok-admin');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('auth gating (criterion #19)', () => {
    it('does not render the page and redirects to /login when no token is present', async () => {
      localStorage.clear();
      installBackend({ items: [makeItem()] });

      renderPage();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('admin-submissions-page')).not.toBeInTheDocument();
    });
  });

  describe('page states (criteria #16, #19, #20)', () => {
    it('renders the loading state while the list is loading', async () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

      renderPage();

      expect(await screen.findByTestId('admin-submissions-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-submissions-list')).not.toBeInTheDocument();
    });

    it('renders the page root with the localized title in an authorised state', async () => {
      installBackend({ items: [makeItem()] });

      renderPage();

      expect(await screen.findByTestId('admin-submissions-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Review submissions' })).toBeInTheDocument();
    });

    it('requests the pending list from /admin/coins', async () => {
      const fetchMock = installBackend({ items: [makeItem()] });

      renderPage();
      await findItems();

      const [url] = fetchMock.mock.calls[0] as unknown as [string];
      expect(url).toContain('/admin/coins');
      expect(url).toContain('status=pending');
    });

    it('renders the localized empty state when there are no pending submissions', async () => {
      installBackend({ items: [] });

      renderPage();

      const empty = await screen.findByTestId('admin-submissions-empty');
      expect(empty).toHaveTextContent('No submissions are waiting for review.');
      expect(screen.queryByTestId('admin-submissions-list')).not.toBeInTheDocument();
    });

    it('renders the localized forbidden state on a 403, without the list or the empty/error states', async () => {
      installBackend({ getStatus: 403, getBody: { message: 'Forbidden resource' } });

      renderPage();

      const forbidden = await screen.findByTestId('admin-submissions-forbidden');
      expect(forbidden).toHaveTextContent("You don't have permission to view this page.");
      expect(screen.getByTestId('admin-submissions-page')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-submissions-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('admin-submissions-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('admin-submissions-empty')).not.toBeInTheDocument();
    });

    it('renders the generic error state on a non-403 failure (500), not the forbidden state', async () => {
      installBackend({ getStatus: 500, getBody: { message: 'Internal server error' } });

      renderPage();

      const error = await screen.findByTestId('admin-submissions-error');
      expect(error).toHaveTextContent('Something went wrong loading submissions. Please try again.');
      expect(screen.queryByTestId('admin-submissions-forbidden')).not.toBeInTheDocument();
      expect(screen.queryByTestId('admin-submissions-list')).not.toBeInTheDocument();
    });
  });

  describe('list rendering (criterion #16)', () => {
    it('renders one item per pending coin, with label, name and submitter email, in order', async () => {
      installBackend({
        items: [
          makeItem({ id: 'coin-1', year: 1943, mintMark: 'D', name: 'Lincoln Wheat Cent', submitterEmail: 'one@example.com' }),
          makeItem({
            id: 'coin-2',
            country: 'Canada',
            denomination: '5 Cents',
            year: 1937,
            mintMark: '',
            name: 'Beaver Nickel',
            submitterEmail: 'two@example.com',
          }),
        ],
      });

      renderPage();

      const items = await findItems();
      expect(items).toHaveLength(2);
      expect(screen.getByTestId('admin-submissions-list')).toBeInTheDocument();

      expect(within(items[0]).getByTestId('admin-submission-label')).toHaveTextContent('USA 1 Cent (1943 D)');
      expect(within(items[0]).getByTestId('admin-submission-label')).toHaveTextContent('Lincoln Wheat Cent');
      expect(within(items[0]).getByTestId('admin-submission-submitter')).toHaveTextContent('Submitted by');
      expect(within(items[0]).getByTestId('admin-submission-submitter')).toHaveTextContent('one@example.com');

      expect(within(items[1]).getByTestId('admin-submission-label')).toHaveTextContent('Canada 5 Cents');
      expect(within(items[1]).getByTestId('admin-submission-label')).toHaveTextContent('Beaver Nickel');
      expect(within(items[1]).getByTestId('admin-submission-submitter')).toHaveTextContent('two@example.com');
      expect(within(items[1]).getByTestId('admin-submission-submitter')).not.toHaveTextContent('one@example.com');
    });

    it('shows the localized unknown-submitter text when the submitter email is null', async () => {
      installBackend({ items: [makeItem({ submitterEmail: null })] });

      renderPage();

      const [item] = await findItems();
      expect(within(item).getByTestId('admin-submission-submitter')).toHaveTextContent('Unknown submitter');
    });

    it('offers Approve, Reject and Edit on every item', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' }), makeItem({ id: 'coin-2', year: 1950 })] });

      renderPage();

      const items = await findItems();
      for (const item of items) {
        expect(within(item).getByTestId('admin-submission-approve')).toHaveTextContent('Approve');
        expect(within(item).getByTestId('admin-submission-reject')).toHaveTextContent('Reject');
        expect(within(item).getByTestId('admin-submission-edit')).toHaveTextContent('Edit');
      }
    });

    it('keeps the reject and edit forms closed until their buttons are clicked', async () => {
      installBackend({ items: [makeItem()] });

      renderPage();

      const [item] = await findItems();
      expect(within(item).queryByTestId('admin-submission-reject-form')).not.toBeInTheDocument();
      expect(within(item).queryByTestId('admin-submission-edit-form')).not.toBeInTheDocument();
      expect(within(item).queryByTestId('admin-submission-error')).not.toBeInTheDocument();
    });
  });

  describe('duplicate warning (criterion #18)', () => {
    it('shows the warning naming the matching approved coin, linking to its catalog page', async () => {
      installBackend({
        items: [makeItem({ possibleDuplicate: { id: 'approved-9', name: 'The Approved One' } })],
      });

      renderPage();

      const [item] = await findItems();
      const warning = within(item).getByTestId('admin-submission-duplicate-warning');
      expect(warning).toHaveTextContent('Possible duplicate of an approved coin:');
      const link = within(warning).getByTestId('admin-submission-duplicate-link');
      expect(link).toHaveTextContent('The Approved One');
      expect(link.getAttribute('href')).toBe('/catalog/approved-9');
    });

    it('shows no warning element at all when possibleDuplicate is null', async () => {
      installBackend({ items: [makeItem({ possibleDuplicate: null })] });

      renderPage();

      const [item] = await findItems();
      expect(within(item).queryByTestId('admin-submission-duplicate-warning')).not.toBeInTheDocument();
      expect(within(item).queryByTestId('admin-submission-duplicate-link')).not.toBeInTheDocument();
    });

    it('shows the warning only on the item that has a duplicate when several are listed', async () => {
      installBackend({
        items: [
          makeItem({ id: 'coin-1', possibleDuplicate: { id: 'approved-1', name: 'First Match' } }),
          makeItem({ id: 'coin-2', year: 1950, possibleDuplicate: null }),
        ],
      });

      renderPage();

      const items = await findItems();
      expect(within(items[0]).getByTestId('admin-submission-duplicate-warning')).toBeInTheDocument();
      expect(within(items[1]).queryByTestId('admin-submission-duplicate-warning')).not.toBeInTheDocument();
    });
  });

  describe('approve (criteria #16, #20)', () => {
    it('sends PATCH /admin/coins/:id with { status: "approved" } and nothing else', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].url.endsWith('/admin/coins/coin-1')).toBe(true);
      expect(backend.patches[0].body).toEqual({ status: 'approved' });
    });

    it('targets the clicked item: approving the second coin patches its id', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' }), makeItem({ id: 'coin-2', year: 1950 })] });
      const user = userEvent.setup();

      renderPage();
      const items = await findItems();
      await user.click(within(items[1]).getByTestId('admin-submission-approve'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].url.endsWith('/admin/coins/coin-2')).toBe(true);
      expect(backend.patches[0].url.endsWith('/admin/coins/coin-1')).toBe(false);
    });

    it('removes the approved coin from the list after the refetch, keeping the other one', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1', name: 'First Coin' }), makeItem({ id: 'coin-2', year: 1950, name: 'Second Coin' })],
      });
      const user = userEvent.setup();

      renderPage();
      const items = await findItems();
      await user.click(within(items[0]).getByTestId('admin-submission-approve'));

      await waitFor(() => expect(screen.getAllByTestId('admin-submission-item')).toHaveLength(1));
      const remaining = screen.getByTestId('admin-submission-item');
      expect(within(remaining).getByTestId('admin-submission-label')).toHaveTextContent('Second Coin');
      expect(screen.queryByText('First Coin', { exact: false })).not.toBeInTheDocument();
    });

    it('shows the empty state once the last pending coin has been approved', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      expect(await screen.findByTestId('admin-submissions-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-submission-item')).not.toBeInTheDocument();
    });

    it('disables the action buttons while the request is pending', async () => {
      let release: () => void = () => {};
      const patchGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      installBackend({ items: [makeItem({ id: 'coin-1' })], patchGate });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      await waitFor(() => expect(within(item).getByTestId('admin-submission-approve')).toBeDisabled());
      expect(within(item).getByTestId('admin-submission-reject')).toBeDisabled();
      expect(within(item).getByTestId('admin-submission-edit')).toBeDisabled();

      release();
      await waitFor(() => expect(screen.queryByTestId('admin-submission-item')).not.toBeInTheDocument());
    });
  });

  describe('reject (criteria #16, #20)', () => {
    it('opens the inline reject form with a 500-character reason textarea and no request yet', async () => {
      installBackend({ items: [makeItem()] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));

      expect(within(item).getByTestId('admin-submission-reject-form')).toBeInTheDocument();
      const reason = within(item).getByTestId('admin-submission-reject-reason');
      expect(reason).toHaveAttribute('maxlength', '500');
      expect(within(item).getByLabelText('Reason (optional)')).toBe(reason);
      expect(backend.patches).toHaveLength(0);
    });

    it('sends { status: "rejected", rejectionReason } with the trimmed reason on confirm', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));
      await user.type(within(item).getByTestId('admin-submission-reject-reason'), '  Photo is blurry  ');
      await user.click(within(item).getByTestId('admin-submission-reject-confirm'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].url.endsWith('/admin/coins/coin-1')).toBe(true);
      expect(backend.patches[0].body).toEqual({ status: 'rejected', rejectionReason: 'Photo is blurry' });
    });

    it('sends a different reason verbatim (not a constant)', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));
      await user.type(within(item).getByTestId('admin-submission-reject-reason'), 'Not a real coin');
      await user.click(within(item).getByTestId('admin-submission-reject-confirm'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].body).toEqual({ status: 'rejected', rejectionReason: 'Not a real coin' });
    });

    it('sends only { status: "rejected" } when the reason is left empty', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));
      await user.click(within(item).getByTestId('admin-submission-reject-confirm'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].body).toEqual({ status: 'rejected' });
      expect(backend.patches[0].body).not.toHaveProperty('rejectionReason');
    });

    it('sends only { status: "rejected" } when the reason is only whitespace', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));
      fireEvent.change(within(item).getByTestId('admin-submission-reject-reason'), { target: { value: '    ' } });
      await user.click(within(item).getByTestId('admin-submission-reject-confirm'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].body).toEqual({ status: 'rejected' });
    });

    it('closes the form and sends no request on cancel', async () => {
      installBackend({ items: [makeItem()] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-reject'));
      await user.type(within(item).getByTestId('admin-submission-reject-reason'), 'typed but cancelled');
      await user.click(within(item).getByTestId('admin-submission-reject-cancel'));

      expect(within(item).queryByTestId('admin-submission-reject-form')).not.toBeInTheDocument();
      expect(backend.patches).toHaveLength(0);
    });

    it('removes the rejected coin from the list after the refetch', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1', name: 'First Coin' }), makeItem({ id: 'coin-2', year: 1950, name: 'Second Coin' })],
        patchBody: { id: 'coin-1', status: 'rejected' },
      });
      const user = userEvent.setup();

      renderPage();
      const items = await findItems();
      await user.click(within(items[0]).getByTestId('admin-submission-reject'));
      await user.click(within(items[0]).getByTestId('admin-submission-reject-confirm'));

      await waitFor(() => expect(screen.getAllByTestId('admin-submission-item')).toHaveLength(1));
      expect(
        within(screen.getByTestId('admin-submission-item')).getByTestId('admin-submission-label'),
      ).toHaveTextContent('Second Coin');
    });
  });

  describe('edit before approval (criterion #17)', () => {
    it('opens the inline edit form pre-filled from the coin', async () => {
      installBackend({ items: [makeItem()] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));

      expect(within(item).getByTestId('admin-submission-edit-form')).toBeInTheDocument();
      expect(within(item).getByTestId('admin-submission-edit-country')).toHaveValue('USA');
      expect(within(item).getByTestId('admin-submission-edit-denomination')).toHaveValue('1 Cent');
      expect(within(item).getByTestId('admin-submission-edit-name')).toHaveValue('Lincoln Wheat Cent');
      expect(within(item).getByTestId('admin-submission-edit-year')).toHaveValue(1943);
      expect(within(item).getByTestId('admin-submission-edit-mint-mark')).toHaveValue('D');
      expect(within(item).getByTestId('admin-submission-edit-variety')).toHaveValue('Steel');
      expect(backend.patches).toHaveLength(0);
    });

    it('pre-fills from a different coin (values come from the coin, not constants)', async () => {
      installBackend({
        items: [
          makeItem({
            id: 'coin-2',
            country: 'Canada',
            denomination: '5 Cents',
            name: 'Beaver Nickel',
            year: 1937,
            mintMark: '',
            variety: 'Dot',
          }),
        ],
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));

      expect(within(item).getByTestId('admin-submission-edit-country')).toHaveValue('Canada');
      expect(within(item).getByTestId('admin-submission-edit-year')).toHaveValue(1937);
      expect(within(item).getByTestId('admin-submission-edit-mint-mark')).toHaveValue('');
      expect(within(item).getByTestId('admin-submission-edit-variety')).toHaveValue('Dot');
    });

    it('sends { status: "approved", ...all fields } with the current form values, year as a number', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));
      fireEvent.change(within(item).getByTestId('admin-submission-edit-name'), { target: { value: 'Fixed Name' } });
      fireEvent.change(within(item).getByTestId('admin-submission-edit-year'), { target: { value: '1944' } });
      await user.click(within(item).getByTestId('admin-submission-edit-save'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].url.endsWith('/admin/coins/coin-1')).toBe(true);
      expect(backend.patches[0].body).toEqual({
        status: 'approved',
        country: 'USA',
        denomination: '1 Cent',
        name: 'Fixed Name',
        year: 1944,
        mintMark: 'D',
        variety: 'Steel',
      });
      expect(typeof backend.patches[0].body.year).toBe('number');
    });

    it('sends the edited country, denomination, mint mark and variety, including a cleared mint mark', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));
      fireEvent.change(within(item).getByTestId('admin-submission-edit-country'), { target: { value: 'Canada' } });
      fireEvent.change(within(item).getByTestId('admin-submission-edit-denomination'), { target: { value: '5 Cents' } });
      fireEvent.change(within(item).getByTestId('admin-submission-edit-mint-mark'), { target: { value: '' } });
      fireEvent.change(within(item).getByTestId('admin-submission-edit-variety'), { target: { value: 'Dot' } });
      await user.click(within(item).getByTestId('admin-submission-edit-save'));

      await waitFor(() => expect(backend.patches).toHaveLength(1));
      expect(backend.patches[0].body).toEqual({
        status: 'approved',
        country: 'Canada',
        denomination: '5 Cents',
        name: 'Lincoln Wheat Cent',
        year: 1943,
        mintMark: '',
        variety: 'Dot',
      });
    });

    it('closes the form and sends no request on cancel', async () => {
      installBackend({ items: [makeItem()] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));
      fireEvent.change(within(item).getByTestId('admin-submission-edit-name'), { target: { value: 'Discarded' } });
      await user.click(within(item).getByTestId('admin-submission-edit-cancel'));

      expect(within(item).queryByTestId('admin-submission-edit-form')).not.toBeInTheDocument();
      expect(backend.patches).toHaveLength(0);
    });

    it('removes the coin from the list after saving and approving', async () => {
      installBackend({ items: [makeItem({ id: 'coin-1' })] });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));
      await user.click(within(item).getByTestId('admin-submission-edit-save'));

      expect(await screen.findByTestId('admin-submissions-empty')).toBeInTheDocument();
    });
  });

  describe('action errors (criteria #8, #10)', () => {
    it('shows the localized conflict message on a 409 and keeps the coin listed', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1' })],
        patchStatus: 409,
        patchBody: { message: 'This coin has already been reviewed' },
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      const error = await within(item).findByTestId('admin-submission-error');
      expect(error).toHaveTextContent(
        'This submission was already reviewed, or another coin already has the same details.',
      );
      expect(screen.getAllByTestId('admin-submission-item')).toHaveLength(1);
    });

    it('shows the API validation details joined by ", " on a 400', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1' })],
        patchStatus: 400,
        patchBody: { message: ['year must not be less than 1000', 'name must be a string'] },
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-edit'));
      await user.click(within(item).getByTestId('admin-submission-edit-save'));

      const error = await within(item).findByTestId('admin-submission-error');
      expect(error).toHaveTextContent('year must not be less than 1000, name must be a string');
    });

    it('shows the localized forbidden message on a 403', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1' })],
        patchStatus: 403,
        patchBody: { message: 'Forbidden resource' },
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      const error = await within(item).findByTestId('admin-submission-error');
      expect(error).toHaveTextContent("You don't have permission to view this page.");
    });

    it('shows the generic message on any other failure (500)', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1' })],
        patchStatus: 500,
        patchBody: { message: 'Internal server error' },
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      const error = await within(item).findByTestId('admin-submission-error');
      expect(error).toHaveTextContent('Something went wrong. Please try again.');
    });

    it('re-enables the action buttons after a failure', async () => {
      installBackend({
        items: [makeItem({ id: 'coin-1' })],
        patchStatus: 500,
        patchBody: { message: 'Internal server error' },
      });
      const user = userEvent.setup();

      renderPage();
      const [item] = await findItems();
      await user.click(within(item).getByTestId('admin-submission-approve'));

      await within(item).findByTestId('admin-submission-error');
      expect(within(item).getByTestId('admin-submission-approve')).toBeEnabled();
    });
  });
});
