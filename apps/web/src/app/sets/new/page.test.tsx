/**
 * Tests for: NewSetPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: NewSetPage
 * Covers criteria: #10, #11, #12, #13 (from prd.md)
 *
 * useCreateSet is mocked with both `mutate` (callback-style) and `mutateAsync`
 * (promise-style) wired to the same resolved/rejected outcome, since the Interface
 * Contract's Behavior bullet doesn't pin down which TanStack Query calling convention
 * the Coder uses for the redirect/error-surfacing — only the observable result
 * (router.push call, or inline error text) is asserted here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewSetPage from '@/app/sets/new/page';
import { useCreateSet } from '@/lib/hooks/use-user-sets';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import { setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useCreateSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
}));

const useCreateSetMock = vi.mocked(useCreateSet);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);
const usePublicSetsMock = vi.mocked(usePublicSets);

const CANONICAL_SETS = [
  { id: 'c1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1' },
  { id: 'c2', name: 'Lincoln Wheat Cent Key Dates', description: null, source: 'seed-template', templateVersion: 'v1' },
];

const PUBLIC_SETS_PAGE = {
  items: [
    {
      id: 'u1',
      userId: 'user-2',
      name: "Bob's Set",
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
};

const NEW_SET = {
  id: 'new-set-1',
  userId: 'user-1',
  name: 'My New Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCreateSetMock({
  resolvedValue,
  rejectedValue,
}: {
  resolvedValue?: typeof NEW_SET;
  rejectedValue?: Error;
} = {}) {
  const mutateAsync = vi.fn(async () => {
    if (rejectedValue) throw rejectedValue;
    return resolvedValue;
  });
  const mutate = vi.fn(
    (_body: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) {
        opts?.onError?.(rejectedValue);
      } else {
        opts?.onSuccess?.(resolvedValue);
      }
    },
  );
  return { mutate, mutateAsync, isPending: false };
}

describe('NewSetPage', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('tok-abc');
    pushMock.mockClear();
    searchParamsValue = new URLSearchParams();
    useCreateSetMock.mockReset();
    useCanonicalSetsMock.mockReset();
    usePublicSetsMock.mockReset();
    useCanonicalSetsMock.mockReturnValue({ data: CANONICAL_SETS, isLoading: false, isError: false } as never);
    usePublicSetsMock.mockReturnValue({ data: PUBLIC_SETS_PAGE, isLoading: false, isError: false } as never);
    useCreateSetMock.mockReturnValue(makeCreateSetMock({ resolvedValue: NEW_SET }) as never);
  });

  describe('rendering', () => {
    it('renders the page root, name input, mode selector, and submit button, defaulting to blank mode with no query params', async () => {
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-page')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-new-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-mode-blank')).toBeChecked();
      expect(screen.getByTestId('set-new-mode-canonical')).not.toBeChecked();
      expect(screen.getByTestId('set-new-mode-public')).not.toBeChecked();
      expect(screen.getByTestId('set-new-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-canonical-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-public-select')).not.toBeInTheDocument();
    });
  });

  describe('criterion 10: three creation paths available from one form', () => {
    it('shows the canonical picker only when canonical mode is selected', async () => {
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.click(screen.getByTestId('set-new-mode-canonical'));
      expect(screen.getByTestId('set-new-canonical-select')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-public-select')).not.toBeInTheDocument();
    });

    it('shows the public picker only when public mode is selected', async () => {
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.click(screen.getByTestId('set-new-mode-public'));
      expect(screen.getByTestId('set-new-public-select')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-canonical-select')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: pre-selects the clone source from CTA query params', () => {
    it('defaults to canonical mode with the canonical select pre-filled when cloneFrom=canonical', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-mode-canonical')).toBeChecked();
      });
      expect(screen.getByTestId('set-new-canonical-select')).toHaveValue('c2');
    });

    it('defaults to public mode with the public select pre-filled when cloneFrom=user', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-mode-public')).toBeChecked();
      });
      expect(screen.getByTestId('set-new-public-select')).toHaveValue('u1');
    });
  });

  describe('criterion 10/12: submitting blank mode creates a plain set and redirects on success', () => {
    it('calls the create mutation with just { name } and redirects to the new set page', async () => {
      const user = userEvent.setup();
      const createSetMock = makeCreateSetMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.type(screen.getByTestId('set-new-name-input'), 'My New Set');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const calledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(calledWith).toEqual({ name: 'My New Set' });
    });
  });

  describe('criterion 10/12: submitting canonical-clone mode sends the selected canonical source', () => {
    it('calls the create mutation with a canonical cloneFrom payload', async () => {
      const user = userEvent.setup();
      const createSetMock = makeCreateSetMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-canonical-select')).toHaveValue('c2'));

      await user.type(screen.getByTestId('set-new-name-input'), 'My Wheat Cents');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const calledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(calledWith).toEqual({ name: 'My Wheat Cents', cloneFrom: { type: 'canonical', id: 'c2' } });
    });
  });

  describe('criterion 10/12: submitting public-clone mode sends the selected public source', () => {
    it('calls the create mutation with a user cloneFrom payload', async () => {
      const user = userEvent.setup();
      const createSetMock = makeCreateSetMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-public-select')).toHaveValue('u1'));

      await user.type(screen.getByTestId('set-new-name-input'), "My Clone of Bob's Set");
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const calledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(calledWith).toEqual({ name: "My Clone of Bob's Set", cloneFrom: { type: 'user', id: 'u1' } });
    });
  });

  describe('criterion 13: creation failure surfaces inline, without navigating away', () => {
    it('renders the error message from the failed mutation and does not redirect', async () => {
      const user = userEvent.setup();
      const failingMock = makeCreateSetMock({ rejectedValue: new Error('Name already in use') });
      useCreateSetMock.mockReturnValue(failingMock as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.type(screen.getByTestId('set-new-name-input'), 'Duplicate Name');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('set-new-error')).toHaveTextContent('Name already in use');
      });
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
