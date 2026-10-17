/**
 * Tests for: NewSetPage (two-step new-set flow)
 * Contract source: runs/run_20261013_062900/plan.md § Interface Contract → Page: NewSetPage
 *                   runs/run_20261017_142658/plan.md § Approach §3 (preview title and subtitle via getCoinName)
 * Covers criteria: #1-#16, #22 (from runs/run_20261013_062900/prd.md)
 *
 * This file replaces the previous picker/pending-list tests (run_20260728_071525), which tested the
 * create-then-patch design that D1 of the new plan removes. `set-new-page`, `set-new-name-input`,
 * `set-new-submit` and `set-new-error` are kept; the picker and in-set ids are asserted absent.
 *
 * run_20261017_142658: only the "criterion 11: coin preview" first test changes. The preview rows now
 * show getCoinName(coin).title and .subtitle (set-new-preview-title / set-new-preview-subtitle) instead of
 * the removed getAlbumCardText. COIN_A and COIN_B share baseCoin (same name, no variety), so their titles
 * are equal; the rows are told apart by their subtitles, which carry the year and mint mark.
 *
 * CONTRACT_GAP: none.
 *
 * English copy comes from the plan's i18n table (the default context renders English with no provider).
 * The four set hooks and useCreateSet are mocked. usePatchSetCoins is kept in the mocked module's
 * factory only so the test can prove it is never called.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoinName } from '@coin-collector/shared';
import NewSetPage from '@/app/sets/new/page';
import { useCreateSet, usePatchSetCoins } from '@/lib/hooks/use-user-sets';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useCreateSet: vi.fn(),
  usePatchSetCoins: vi.fn(),
}));

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
  usePublicSet: vi.fn(),
}));

const useCreateSetMock = vi.mocked(useCreateSet);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);
const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const usePublicSetsMock = vi.mocked(usePublicSets);
const usePublicSetMock = vi.mocked(usePublicSet);

const baseCoin = {
  country: 'USA',
  denomination: '1 Cent',
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null as string | null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'approved' as const,
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const COIN_A = { ...baseCoin, id: 'coin-a', year: 1909, mintMark: 'S' };
const COIN_B = { ...baseCoin, id: 'coin-b', year: 1943 };

const CANONICAL_SETS = [
  {
    id: 'c1',
    name: 'Lincoln Wheat Cents',
    description: 'Every wheat cent from 1909 to 1958',
    source: 'seed-template',
    templateVersion: 'v1',
    coinCount: 12,
  },
  {
    id: 'c2',
    name: 'Lincoln Wheat Cent Key Dates',
    description: null,
    source: 'seed-template',
    templateVersion: 'v1',
    coinCount: 2,
  },
];

const CANONICAL_DETAIL_C2 = {
  id: 'c2',
  name: 'Lincoln Wheat Cent Key Dates',
  description: null,
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [
    { id: 'csc-1', position: 0, coin: COIN_A },
    { id: 'csc-2', position: 1, coin: COIN_B },
  ],
};

const CANONICAL_DETAIL_C1 = {
  id: 'c1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent from 1909 to 1958',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [{ id: 'csc-3', position: 0, coin: { ...baseCoin, id: 'coin-c', year: 1950 } }],
};

const PUBLIC_ITEMS = [
  {
    id: 'u1',
    userId: 'user-2',
    name: "Bob's Set",
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    coinCount: 42,
  },
  {
    id: 'u2',
    userId: 'user-3',
    name: 'Euro Collection',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    coinCount: 7,
  },
];

const PUBLIC_SETS_PAGE = { items: PUBLIC_ITEMS, page: 1, limit: 100, total: 2 };

const PUBLIC_DETAIL_U1 = {
  id: 'u1',
  userId: 'user-2',
  name: "Bob's Set",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 0, coin: { ...baseCoin, id: 'coin-p1', year: 1960, country: 'Canada' } },
    { id: 'usc-2', position: 1, coin: { ...baseCoin, id: 'coin-p2', year: 1970, country: 'Austria' } },
    { id: 'usc-3', position: 2, coin: { ...baseCoin, id: 'coin-p3', year: 1980, country: 'Canada' } },
  ],
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

const IDLE = { data: undefined, isLoading: false, isError: false };

function makeBigDetail(count: number) {
  return {
    id: 'big',
    name: 'Ukraine Circulation Coins',
    description: null,
    source: 'seed-template',
    templateVersion: 'v1',
    coins: Array.from({ length: count }, (_, i) => ({
      id: `big-${i + 1}`,
      position: i + 1,
      coin: { ...baseCoin, id: `big-coin-${i + 1}`, year: 1992 + (i % 35), country: 'Ukraine' },
    })),
  };
}

function makeMutationMock({
  resolvedValue,
  rejectedValue,
  isPending = false,
}: {
  resolvedValue?: unknown;
  rejectedValue?: Error;
  isPending?: boolean;
} = {}) {
  const mutate = vi.fn(
    (_body: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) {
        opts?.onError?.(rejectedValue);
      } else {
        opts?.onSuccess?.(resolvedValue);
      }
    },
  );
  return { mutate, isPending };
}

/** Make the canonical detail hook answer per id; every other id is idle. */
function mockCanonicalDetails(byId: Record<string, unknown>) {
  useCanonicalSetMock.mockImplementation(((id: string) =>
    id in byId ? byId[id] : IDLE) as never);
}

function mockPublicDetails(byId: Record<string, unknown>) {
  usePublicSetMock.mockImplementation(((id: string) => (id in byId ? byId[id] : IDLE)) as never);
}

function loaded(data: unknown) {
  return { data, isLoading: false, isError: false };
}

const ERRORED = { data: undefined, isLoading: false, isError: true };

async function renderPage() {
  render(<NewSetPage />);
  await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());
}

function findCardByText(testId: string, text: string) {
  const match = screen.getAllByTestId(testId).find((el) => el.textContent?.includes(text));
  if (!match) throw new Error(`No ${testId} containing "${text}"`);
  return match;
}

const nameInput = () => screen.getByTestId<HTMLInputElement>('set-new-name-input');

describe('NewSetPage', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('tok-abc');
    pushMock.mockClear();
    searchParamsValue = new URLSearchParams();
    useCreateSetMock.mockReset();
    usePatchSetCoinsMock.mockReset();
    useCanonicalSetsMock.mockReset();
    useCanonicalSetMock.mockReset();
    usePublicSetsMock.mockReset();
    usePublicSetMock.mockReset();

    useCanonicalSetsMock.mockReturnValue(loaded(CANONICAL_SETS) as never);
    useCanonicalSetMock.mockReturnValue(IDLE as never);
    usePublicSetsMock.mockReturnValue(loaded(PUBLIC_SETS_PAGE) as never);
    usePublicSetMock.mockReturnValue(IDLE as never);
    useCreateSetMock.mockReturnValue(makeMutationMock({ resolvedValue: NEW_SET }) as never);
  });

  describe('criterion 1: no params opens step 1 with Curated selected', () => {
    it('renders step 1, not step 2, with the canonical option checked and the others unchecked', async () => {
      await renderPage();

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('set-new-option-public')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('set-new-option-blank')).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByTestId('set-new-not-found')).not.toBeInTheDocument();
    });

    it('treats an unrecognised cloneFrom value like no params', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=bogus&cloneFromId=c1');
      await renderPage();

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByTestId('set-new-not-found')).not.toBeInTheDocument();
    });

    it('calls the detail hooks with an empty id when no source is picked', async () => {
      await renderPage();

      expect(useCanonicalSetMock).toHaveBeenCalled();
      expect(useCanonicalSetMock.mock.calls.every((call) => call[0] === '')).toBe(true);
      expect(usePublicSetMock.mock.calls.every((call) => call[0] === '')).toBe(true);
    });

    it('asserts the removed picker and pending-list test ids are gone', async () => {
      await renderPage();

      for (const id of [
        'set-new-mode-blank',
        'set-new-mode-canonical',
        'set-new-mode-public',
        'set-new-source-list',
        'set-new-source-item',
        'set-new-picker-panel',
        'set-new-picker-results',
        'set-new-picker-item',
        'set-new-picker-add-button',
        'set-new-in-set-empty',
        'set-new-in-set-list',
        'set-new-in-set-item',
        'set-new-in-set-remove-button',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });
  });

  describe('criterion 16: page head', () => {
    it('shows the breadcrumb "My sets / New set" with a dashboard link and an h1 "New set"', async () => {
      await renderPage();

      const breadcrumb = screen.getByTestId('set-new-breadcrumb');
      expect(breadcrumb).toHaveTextContent('My sets');
      expect(breadcrumb).toHaveTextContent('New set');
      expect(within(breadcrumb).getByRole('link', { name: 'My sets' })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New set');
    });

    it('uses a 1200px max-width container', async () => {
      await renderPage();

      expect(screen.getByTestId('set-new-page').className).toContain('max-w-[1200px]');
    });
  });

  describe('criterion 5: step indicator', () => {
    it('on step 1: step-1 button is current, step-2 is not', async () => {
      await renderPage();

      expect(screen.getByTestId('set-new-stepper')).toBeInTheDocument();
      const first = screen.getByTestId('set-new-stepper-1');
      expect(first.tagName).toBe('BUTTON');
      expect(first).toHaveAttribute('aria-current', 'step');
      expect(first).toHaveTextContent('Starting point');
      const second = screen.getByTestId('set-new-stepper-2');
      expect(second).not.toHaveAttribute('aria-current');
      expect(second).toHaveTextContent('Name & create');
    });

    it('on step 2: step-2 is current and step-1 has no aria-current', async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-stepper-2')).toHaveAttribute('aria-current', 'step');
      expect(screen.getByTestId('set-new-stepper-1')).not.toHaveAttribute('aria-current');
    });

    it('clicking the step-1 button on step 2 goes back to step 1 with the option kept', async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));
      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();

      await user.click(screen.getByTestId('set-new-stepper-1'));

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-blank')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('criterion 6: option cards', () => {
    it('renders three radios inside a radiogroup, in canonical, public, blank order', async () => {
      await renderPage();

      const group = screen.getByRole('radiogroup');
      const radios = within(group).getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(radios[0]).toBe(screen.getByTestId('set-new-option-canonical'));
      expect(radios[1]).toBe(screen.getByTestId('set-new-option-public'));
      expect(radios[2]).toBe(screen.getByTestId('set-new-option-blank'));
      radios.forEach((radio) => expect(radio.tagName).toBe('BUTTON'));
    });

    it('shows the titles and descriptions from the brief', async () => {
      await renderPage();

      expect(screen.getByTestId('set-new-option-canonical')).toHaveTextContent('Curated checklist');
      expect(screen.getByTestId('set-new-option-canonical')).toHaveTextContent(
        'A complete series list maintained by Coin Collector Companion. The easiest way to start.',
      );
      expect(screen.getByTestId('set-new-option-public')).toHaveTextContent("Copy a collector's set");
      expect(screen.getByTestId('set-new-option-public')).toHaveTextContent(
        'Start from a set another collector has shared.',
      );
      expect(screen.getByTestId('set-new-option-blank')).toHaveTextContent('Start empty');
      expect(screen.getByTestId('set-new-option-blank')).toHaveTextContent('Pick every coin yourself from the catalog.');
    });

    it('puts the Recommended pill on the canonical option only', async () => {
      await renderPage();

      const pill = screen.getByTestId('set-new-recommended');
      expect(pill).toHaveTextContent('Recommended');
      expect(screen.getByTestId('set-new-option-canonical')).toContainElement(pill);
      expect(screen.getByTestId('set-new-option-public')).not.toHaveTextContent('Recommended');
      expect(screen.getByTestId('set-new-option-blank')).not.toHaveTextContent('Recommended');
    });

    it('clicking an option selects it and stays on step 1', async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-option-public'));

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-public')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('criterion 7: curated checklist cards', () => {
    it('shows the heading and a card per canonical set with name, description and a coinCount chip', async () => {
      await renderPage();

      expect(screen.getByText('Choose a checklist')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-canonical-list')).toBeInTheDocument();
      expect(screen.getAllByTestId('set-new-canonical-card')).toHaveLength(2);

      const first = findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents');
      expect(first).toHaveTextContent('Every wheat cent from 1909 to 1958');
      expect(first).toHaveTextContent('12 coins');
      const second = findCardByText('set-new-canonical-card', 'Lincoln Wheat Cent Key Dates');
      expect(second).toHaveTextContent('2 coins');
      expect(second).not.toHaveTextContent('12 coins');
    });

    it('shows a skeleton wrapper while the list loads and no cards', async () => {
      useCanonicalSetsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
      await renderPage();

      expect(screen.getByTestId('set-new-sources-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-canonical-list')).not.toBeInTheDocument();
    });

    it('shows an error line when the list fails and no cards', async () => {
      useCanonicalSetsMock.mockReturnValue(ERRORED as never);
      await renderPage();

      expect(screen.getByTestId('set-new-sources-error')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-canonical-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-sources-loading')).not.toBeInTheDocument();
    });

    it('clicking a card moves to step 2 with that source, requesting its detail by id', async () => {
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cent Key Dates'));

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-name')).toHaveTextContent('Lincoln Wheat Cent Key Dates');
      expect(useCanonicalSetMock.mock.calls.some((call) => call[0] === 'c2')).toBe(true);
    });
  });

  describe('criterion 8: public sets', () => {
    async function openPublic() {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-public'));
      return user;
    }

    it('shows the heading, the search input, and a card per public set with its coinCount chip', async () => {
      await openPublic();

      expect(screen.getByText("Choose a collector's set")).toBeInTheDocument();
      expect(screen.getByTestId('set-new-public-search')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-canonical-list')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('set-new-public-card')).toHaveLength(2);
      expect(findCardByText('set-new-public-card', "Bob's Set")).toHaveTextContent('42 coins');
      expect(findCardByText('set-new-public-card', 'Euro Collection')).toHaveTextContent('7 coins');
    });

    it('filters the loaded list by name, case-insensitively, on the client', async () => {
      const user = await openPublic();

      await user.type(screen.getByTestId('set-new-public-search'), 'BOB');

      const cards = screen.getAllByTestId('set-new-public-card');
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent("Bob's Set");
    });

    it('a different search term gives a different result, and no match gives no cards', async () => {
      const user = await openPublic();

      await user.type(screen.getByTestId('set-new-public-search'), 'euro');
      expect(screen.getAllByTestId('set-new-public-card')).toHaveLength(1);
      expect(screen.getByTestId('set-new-public-card')).toHaveTextContent('Euro Collection');

      await user.clear(screen.getByTestId('set-new-public-search'));
      await user.type(screen.getByTestId('set-new-public-search'), 'zzz-no-match');
      expect(screen.queryByTestId('set-new-public-card')).not.toBeInTheDocument();
    });

    it('ignores surrounding whitespace in the search term', async () => {
      const user = await openPublic();

      await user.type(screen.getByTestId('set-new-public-search'), '  bob  ');

      expect(screen.getAllByTestId('set-new-public-card')).toHaveLength(1);
    });

    it('always calls usePublicSets with page 1 and limit 100, however the search changes', async () => {
      const user = await openPublic();
      await user.type(screen.getByTestId('set-new-public-search'), 'bob');

      expect(usePublicSetsMock).toHaveBeenCalled();
      expect(usePublicSetsMock.mock.calls.every((call) => call[0]?.page === 1 && call[0]?.limit === 100)).toBe(true);
    });

    it('shows the loading wrapper and the error line for the public list', async () => {
      usePublicSetsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
      await openPublic();
      expect(screen.getByTestId('set-new-sources-loading')).toBeInTheDocument();
    });

    it('shows the error line when the public list fails', async () => {
      usePublicSetsMock.mockReturnValue(ERRORED as never);
      await openPublic();
      expect(screen.getByTestId('set-new-sources-error')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-public-list')).not.toBeInTheDocument();
    });

    it('clicking a card moves to step 2 with the public eyebrow and copy-safety description', async () => {
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      const user = await openPublic();

      await user.click(findCardByText('set-new-public-card', "Bob's Set"));

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-eyebrow')).toHaveTextContent("Copying a collector's set");
      expect(screen.getByTestId('set-new-source-description')).toHaveTextContent(
        "You get your own copy. Changes you make won't affect the original.",
      );
      expect(screen.getByTestId('set-new-source-name')).toHaveTextContent("Bob's Set");
      expect(usePublicSetMock.mock.calls.some((call) => call[0] === 'u1')).toBe(true);
    });
  });

  describe('criterion 9: blank flow', () => {
    async function goBlank() {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      return user;
    }

    it('shows the explanation panel and a Continue button instead of a source list', async () => {
      await goBlank();

      const panel = screen.getByTestId('set-new-blank-panel');
      expect(panel).toHaveTextContent(
        "You'll create an empty set, then add coins from the catalog one by one.",
      );
      expect(within(panel).getByTestId('set-new-continue')).toHaveTextContent('Continue');
      expect(screen.queryByTestId('set-new-canonical-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-public-list')).not.toBeInTheDocument();
    });

    it('Continue goes to step 2 with the blank source card, no preview, no chips and an empty name', async () => {
      const user = await goBlank();

      await user.click(screen.getByTestId('set-new-continue'));

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-eyebrow')).toHaveTextContent('Starting from');
      expect(screen.getByTestId('set-new-source-name')).toHaveTextContent('An empty set');
      expect(screen.getByTestId('set-new-source-description')).toHaveTextContent(
        'After creating it, use “Add coins” to pick coins from the catalog.',
      );
      expect(screen.queryByTestId('set-new-source-chips')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-preview')).not.toBeInTheDocument();
      expect(nameInput().value).toBe('');
    });

    it('labels the submit "Create set" with no count and uses the blank "what happens next" line', async () => {
      const user = await goBlank();

      await user.click(screen.getByTestId('set-new-continue'));

      expect(screen.getByTestId('set-new-submit')).toHaveTextContent(/^Create set$/);
      const next = screen.getByTestId('set-new-next-steps');
      expect(within(next).getAllByRole('listitem')).toHaveLength(3);
      expect(next).toHaveTextContent('Your empty set opens, ready for “Add coins”.');
      expect(next).toHaveTextContent('Tick the coins you already own. The gaps show what to look for.');
      expect(next).toHaveTextContent('Add or remove coins any time.');
    });
  });

  describe('criteria 2 and 3: entering from a clone link', () => {
    it('cloneFrom=canonical opens step 2 with the canonical option, source card, preview and pre-filled name', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-card')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-eyebrow')).toHaveTextContent('Curated checklist');
      expect(screen.getByTestId('set-new-source-name')).toHaveTextContent('Lincoln Wheat Cent Key Dates');
      expect(screen.getByTestId('set-new-preview')).toBeInTheDocument();
      expect(nameInput().value).toBe('Lincoln Wheat Cent Key Dates');
      expect(useCanonicalSetMock.mock.calls.some((call) => call[0] === 'c2')).toBe(true);
    });

    it('cloneFrom=user opens step 2 with the public eyebrow, copy description and pre-filled name', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      await renderPage();

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-source-eyebrow')).toHaveTextContent("Copying a collector's set");
      expect(screen.getByTestId('set-new-source-description')).toHaveTextContent(
        "You get your own copy. Changes you make won't affect the original.",
      );
      expect(nameInput().value).toBe("Bob's Set");
      expect(usePublicSetMock.mock.calls.some((call) => call[0] === 'u1')).toBe(true);
    });

    it('takes the pre-filled name from the detail when the id is not in the loaded list', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c9');
      mockCanonicalDetails({
        c9: loaded({ ...CANONICAL_DETAIL_C2, id: 'c9', name: 'Detail Only Name', description: 'From the detail' }),
      });
      await renderPage();

      await waitFor(() => expect(nameInput().value).toBe('Detail Only Name'));
      expect(screen.getByTestId('set-new-source-name')).toHaveTextContent('Detail Only Name');
      expect(screen.getByTestId('set-new-source-description')).toHaveTextContent('From the detail');
    });

    it('does not overwrite a name the user typed once the source name is known', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      fireEvent.change(nameInput(), { target: { value: 'My own name' } });

      expect(nameInput().value).toBe('My own name');
    });
  });

  describe('criterion 4: unknown or missing source id', () => {
    it('falls back to step 1 with the not-found note when the detail query errors, keeping Curated selected', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=missing-id');
      mockCanonicalDetails({ 'missing-id': ERRORED });
      await renderPage();

      await waitFor(() => expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument());
      expect(screen.queryByTestId('set-new-step-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-not-found')).toHaveTextContent(
        "That set couldn't be found. Choose another starting point.",
      );
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'true');
    });

    it('falls back with the public option selected for a failing cloneFrom=user id', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=missing-id');
      mockPublicDetails({ 'missing-id': ERRORED });
      await renderPage();

      await waitFor(() => expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument());
      expect(screen.getByTestId('set-new-not-found')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-public')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'false');
    });

    it('shows the note on step 1 for cloneFrom=canonical with no cloneFromId', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical');
      await renderPage();

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-not-found')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'true');
    });

    it('shows the note with the public option for cloneFrom=user and an empty cloneFromId', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=');
      await renderPage();

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-not-found')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-public')).toHaveAttribute('aria-checked', 'true');
    });

    it('clears the note when another source is picked and the cancel link then goes to the dashboard', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=missing-id');
      mockCanonicalDetails({ 'missing-id': ERRORED, c1: loaded(CANONICAL_DETAIL_C1) });
      const user = userEvent.setup();
      await renderPage();
      await waitFor(() => expect(screen.getByTestId('set-new-not-found')).toBeInTheDocument());

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-not-found')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-cancel')).toHaveAttribute('href', '/dashboard');
    });

    it('clears the note when the user switches option and presses Continue', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical');
      const user = userEvent.setup();
      await renderPage();
      expect(screen.getByTestId('set-new-not-found')).toBeInTheDocument();

      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      expect(screen.queryByTestId('set-new-not-found')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
    });
  });

  describe('criterion 10: step 2 source card and Change', () => {
    it('shows eyebrow, name, description and a Change button for a canonical pick with a description', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1) });
      const user = userEvent.setup();
      await renderPage();
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      const card = screen.getByTestId('set-new-source-card');
      expect(within(card).getByTestId('set-new-source-eyebrow')).toHaveTextContent('Curated checklist');
      expect(within(card).getByTestId('set-new-source-name')).toHaveTextContent('Lincoln Wheat Cents');
      expect(within(card).getByTestId('set-new-source-description')).toHaveTextContent(
        'Every wheat cent from 1909 to 1958',
      );
      expect(within(card).getByTestId('set-new-change')).toHaveTextContent('Change');
    });

    it('omits the description paragraph for a canonical set whose description is null', async () => {
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cent Key Dates'));

      expect(screen.queryByTestId('set-new-source-description')).not.toBeInTheDocument();
    });

    it('derives the chips from the detail coins: count, year range, single country', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      const chips = screen.getByTestId('set-new-source-chips');
      expect(chips).toHaveTextContent('2 coins');
      expect(chips).toHaveTextContent('1909–1943');
      expect(chips).toHaveTextContent('USA');
      expect(chips).not.toHaveTextContent('countries');
    });

    it('shows "{k} countries" instead of a country name when the coins span several, and a different range', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      await renderPage();

      const chips = screen.getByTestId('set-new-source-chips');
      expect(chips).toHaveTextContent('3 coins');
      expect(chips).toHaveTextContent('1960–1980');
      expect(chips).toHaveTextContent('2 countries');
      expect(chips).not.toHaveTextContent('Canada');
    });

    it('shows a single year (no dash) when every coin has the same year', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({
        c2: loaded({
          ...CANONICAL_DETAIL_C2,
          coins: [
            { id: 'a', position: 0, coin: { ...baseCoin, id: 'x1', year: 1943 } },
            { id: 'b', position: 1, coin: { ...baseCoin, id: 'x2', year: 1943 } },
          ],
        }),
      });
      await renderPage();

      const chips = screen.getByTestId('set-new-source-chips');
      expect(chips).toHaveTextContent('1943');
      expect(chips).not.toHaveTextContent('–');
    });

    it('shows only the "0 coins" chip for an empty canonical set, with no preview rows and no more line', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded({ ...CANONICAL_DETAIL_C2, coins: [] }) });
      await renderPage();

      const chips = screen.getByTestId('set-new-source-chips');
      expect(chips).toHaveTextContent('0 coins');
      expect(chips).not.toHaveTextContent('–');
      expect(screen.queryByTestId('set-new-preview-item')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-preview-more')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-submit')).toHaveTextContent('Create set with 0 coins');
    });

    it('has no chips until the detail has loaded', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: { data: undefined, isLoading: true, isError: false } });
      await renderPage();

      expect(screen.getByTestId('set-new-step-2')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-source-chips')).not.toBeInTheDocument();
    });

    it('Change returns to step 1 with the same option selected (canonical)', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-change'));

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-step-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByTestId('set-new-not-found')).not.toBeInTheDocument();
    });

    it('Change returns to step 1 with the public option still selected', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-change'));

      expect(screen.getByTestId('set-new-step-1')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-option-public')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('set-new-option-canonical')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('criterion 11: coin preview', () => {
    it('lists each coin with its getCoinName title and subtitle, grouped under ascending year headers', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({
        c2: loaded({
          ...CANONICAL_DETAIL_C2,
          coins: [
            { id: 'r1', position: 0, coin: COIN_B },
            { id: 'r2', position: 1, coin: COIN_A },
          ],
        }),
      });
      await renderPage();

      const years = screen.getAllByTestId('set-new-preview-year').map((el) => el.textContent?.trim());
      expect(years).toEqual(['1909', '1943']);
      const items = screen.getAllByTestId('set-new-preview-item');
      expect(items).toHaveLength(2);

      // COIN_A and COIN_B share baseCoin, so their titles are equal and cannot tell the rows apart.
      // The subtitles can: they carry the year and mint mark.
      const nameA = getCoinName(COIN_A);
      const nameB = getCoinName(COIN_B);
      expect(nameA.title).toBe('Lincoln Wheat Cent');
      expect(nameA.subtitle).toBe('USA · 1 Cent · 1909-S');
      expect(nameB.subtitle).toBe('USA · 1 Cent · 1943');

      // Year-ascending groups: COIN_A (1909) renders before COIN_B (1943) although B has the lower position.
      expect(within(items[0]).getByTestId('set-new-preview-title')).toHaveTextContent(nameA.title);
      expect(within(items[0]).getByTestId('set-new-preview-subtitle')).toHaveTextContent(nameA.subtitle);
      expect(within(items[1]).getByTestId('set-new-preview-title')).toHaveTextContent(nameB.title);
      expect(within(items[1]).getByTestId('set-new-preview-subtitle')).toHaveTextContent(nameB.subtitle);
      expect(items[0]).not.toHaveTextContent(nameB.subtitle);
      expect(items[1]).not.toHaveTextContent(nameA.subtitle);
      expect(screen.queryByTestId('set-new-preview-more')).not.toBeInTheDocument();
    });

    it('shows the design as the title and country, denomination and year as the subtitle for a series coin', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      const donetsk = {
        ...baseCoin,
        id: 'coin-donetsk',
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        year: 2025,
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        name: 'Ukraine Commemorative 10 Hryvnias',
      };
      mockCanonicalDetails({
        c2: loaded({ ...CANONICAL_DETAIL_C2, coins: [{ id: 'r1', position: 0, coin: donetsk }] }),
      });
      await renderPage();

      const [item] = screen.getAllByTestId('set-new-preview-item');
      expect(within(item).getByTestId('set-new-preview-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(item).getByTestId('set-new-preview-subtitle')).toHaveTextContent(
        /^Ukraine · 10 Hryvnias · 2025$/,
      );
    });

    it('shows an image disc when a coin has an imageUrl and none when it does not', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({
        c2: loaded({
          ...CANONICAL_DETAIL_C2,
          coins: [
            { id: 'r1', position: 0, coin: { ...COIN_A, imageUrl: 'https://img.example/a.png' } },
            { id: 'r2', position: 1, coin: { ...COIN_B, imageUrl: null } },
          ],
        }),
      });
      await renderPage();

      const items = screen.getAllByTestId('set-new-preview-item');
      const withImage = items[0].querySelector('img');
      expect(withImage).not.toBeNull();
      expect(withImage?.getAttribute('src')).toBe('https://img.example/a.png');
      expect(items[1].querySelector('img')).toBeNull();
    });

    it('caps the preview at 60 coins and shows "+ 127 more" for a 187-coin checklist', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=big');
      mockCanonicalDetails({ big: loaded(makeBigDetail(187)) });
      await renderPage();

      expect(screen.getAllByTestId('set-new-preview-item')).toHaveLength(60);
      expect(screen.getByTestId('set-new-preview-more')).toHaveTextContent('+ 127 more');
      expect(screen.getByTestId('set-new-submit')).toHaveTextContent('Create set with 187 coins');
    });

    it('shows a different remainder for a different size (75 coins gives 60 rows and "+ 15 more")', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=big');
      mockCanonicalDetails({ big: loaded(makeBigDetail(75)) });
      await renderPage();

      expect(screen.getAllByTestId('set-new-preview-item')).toHaveLength(60);
      expect(screen.getByTestId('set-new-preview-more')).toHaveTextContent('+ 15 more');
    });

    it('shows no "more" line for exactly 60 coins', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=big');
      mockCanonicalDetails({ big: loaded(makeBigDetail(60)) });
      await renderPage();

      expect(screen.getAllByTestId('set-new-preview-item')).toHaveLength(60);
      expect(screen.queryByTestId('set-new-preview-more')).not.toBeInTheDocument();
    });

    it('shows a skeleton and no rows while the detail loads', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: { data: undefined, isLoading: true, isError: false } });
      await renderPage();

      expect(screen.getByTestId('set-new-preview')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-preview-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-preview-item')).not.toBeInTheDocument();
    });

    it('has no loading skeleton once the detail has loaded', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      expect(screen.queryByTestId('set-new-preview-loading')).not.toBeInTheDocument();
    });

    it('shows the preview heading and note, and previews public sets too', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      await renderPage();

      const preview = screen.getByTestId('set-new-preview');
      expect(preview).toHaveTextContent("Coins you'll be tracking");
      expect(preview).toHaveTextContent('You can add or remove coins after creating the set.');
      expect(screen.getAllByTestId('set-new-preview-item')).toHaveLength(3);
    });
  });

  describe('criterion 12: aside, name and button label', () => {
    it('renders the aside with heading, labelled required name input, helper line, submit, cancel and next steps', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      const aside = screen.getByTestId('set-new-aside');
      expect(within(aside).getByRole('heading', { level: 2, name: 'Name your set' })).toBeInTheDocument();
      expect(within(aside).getByLabelText('Set name')).toBe(nameInput());
      expect(nameInput()).toBeRequired();
      expect(aside).toHaveTextContent('Sets are public: other collectors can view and copy them.');
      expect(within(aside).getByTestId('set-new-submit')).toBeInTheDocument();
      expect(within(aside).getByTestId('set-new-cancel')).toHaveTextContent('Cancel');
      expect(within(aside).getByTestId('set-new-next-steps')).toBeInTheDocument();
    });

    it('lists the three canonical "what happens next" lines', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      const next = screen.getByTestId('set-new-next-steps');
      expect(within(next).getAllByRole('listitem')).toHaveLength(3);
      expect(next).toHaveTextContent('Your new set opens in album view.');
      expect(next).not.toHaveTextContent('Your empty set opens');
    });

    it('labels the button with the detail coin count once the detail has loaded', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      expect(screen.getByTestId('set-new-submit')).toHaveTextContent('Create set with 2 coins');
    });

    it('uses the list summary coinCount until the detail has loaded (12 for c1), then the detail length', async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      expect(screen.getByTestId('set-new-submit')).toHaveTextContent('Create set with 12 coins');
    });

    it('prefers the loaded detail length over the list coinCount when they differ', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      expect(screen.getByTestId('set-new-submit')).toHaveTextContent('Create set with 1 coins');
    });

    it('pre-fills the name from the picked source the first time, and follows a second pick while untouched', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1), c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));
      expect(nameInput().value).toBe('Lincoln Wheat Cents');

      await user.click(screen.getByTestId('set-new-change'));
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cent Key Dates'));
      expect(nameInput().value).toBe('Lincoln Wheat Cent Key Dates');
    });

    it('never overwrites a typed name, even when another source is picked after Change', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1), c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      fireEvent.change(nameInput(), { target: { value: 'My typed name' } });
      await user.click(screen.getByTestId('set-new-change'));
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cent Key Dates'));

      expect(nameInput().value).toBe('My typed name');
    });

    it('keeps the name when Change is pressed and the same step 2 is re-entered', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1) });
      const user = userEvent.setup();
      await renderPage();
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));
      fireEvent.change(nameInput(), { target: { value: 'Edited' } });

      await user.click(screen.getByTestId('set-new-change'));
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      expect(nameInput().value).toBe('Edited');
    });

    it('leaves a typed name empty-sourced for a blank set and lets the user type', async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      await user.type(nameInput(), 'Fresh');

      expect(nameInput().value).toBe('Fresh');
    });
  });

  describe('criterion 13: Cancel link', () => {
    it('points to the canonical set page when entered from cloneFrom=canonical', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      await renderPage();

      expect(screen.getByTestId('set-new-cancel')).toHaveAttribute('href', '/sets/canonical/c2');
    });

    it('points to the public set page when entered from cloneFrom=user', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      await renderPage();

      expect(screen.getByTestId('set-new-cancel')).toHaveAttribute('href', '/sets/public/u1');
    });

    it('points to the dashboard when there were no clone params, even after picking a source', async () => {
      mockCanonicalDetails({ c1: loaded(CANONICAL_DETAIL_C1) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));

      expect(screen.getByTestId('set-new-cancel')).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('criterion 14: submit sends one create request and redirects', () => {
    it('blank: sends { name } only, once, never calls usePatchSetCoins, and redirects to /sets/{id}', async () => {
      const createMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));
      await user.type(nameInput(), 'My New Set');

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1'));
      expect(createMock.mutate).toHaveBeenCalledTimes(1);
      expect(createMock.mutate.mock.calls[0][0]).toEqual({ name: 'My New Set' });
      expect(usePatchSetCoinsMock).not.toHaveBeenCalled();
    });

    it('canonical: sends { name, cloneFrom: { type: "canonical", id } } and redirects to the new set id', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      const createMock = makeMutationMock({ resolvedValue: { ...NEW_SET, id: 'created-77' } });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      fireEvent.change(nameInput(), { target: { value: 'My Wheat Cents' } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/sets/created-77'));
      expect(createMock.mutate).toHaveBeenCalledTimes(1);
      expect(createMock.mutate.mock.calls[0][0]).toEqual({
        name: 'My Wheat Cents',
        cloneFrom: { type: 'canonical', id: 'c2' },
      });
      expect(usePatchSetCoinsMock).not.toHaveBeenCalled();
    });

    it('public: sends cloneFrom type "user" with the picked id', async () => {
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      const createMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-public'));
      await user.click(findCardByText('set-new-public-card', "Bob's Set"));
      fireEvent.change(nameInput(), { target: { value: "My copy of Bob's" } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1'));
      expect(createMock.mutate).toHaveBeenCalledTimes(1);
      expect(createMock.mutate.mock.calls[0][0]).toEqual({
        name: "My copy of Bob's",
        cloneFrom: { type: 'user', id: 'u1' },
      });
    });

    it('sends the name exactly as typed, without trimming', async () => {
      const createMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));
      fireEvent.change(nameInput(), { target: { value: '  Spaced Name ' } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(createMock.mutate).toHaveBeenCalledTimes(1));
      expect(createMock.mutate.mock.calls[0][0]).toEqual({ name: '  Spaced Name ' });
    });

    it('does not send anything while the required name is empty', async () => {
      const createMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      await user.click(screen.getByTestId('set-new-submit'));

      expect(createMock.mutate).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('shows "Creating…" and disables the button while the create call is pending', async () => {
      useCreateSetMock.mockReturnValue(makeMutationMock({ isPending: true }) as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      const submit = screen.getByTestId('set-new-submit');
      expect(submit).toBeDisabled();
      expect(submit).toHaveTextContent('Creating…');
    });

    it('keeps the button enabled with its normal label when not pending', async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));

      const submit = screen.getByTestId('set-new-submit');
      expect(submit).toBeEnabled();
      expect(submit).not.toHaveTextContent('Creating');
    });
  });

  describe('criterion 15: failure surfaces as role=alert above the submit button', () => {
    async function submitFailing(error: Error) {
      const createMock = makeMutationMock({ rejectedValue: error });
      useCreateSetMock.mockReturnValue(createMock as never);
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));
      await user.type(nameInput(), 'Duplicate Name');
      await user.click(screen.getByTestId('set-new-submit'));
    }

    it('shows the error message with role="alert", does not redirect, and does not patch', async () => {
      await submitFailing(new Error('Name already in use'));

      const alert = await screen.findByTestId('set-new-error');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent('Name already in use');
      expect(pushMock).not.toHaveBeenCalled();
      expect(usePatchSetCoinsMock).not.toHaveBeenCalled();
    });

    it('places the error before the submit button in document order', async () => {
      await submitFailing(new Error('Name already in use'));

      const alert = await screen.findByTestId('set-new-error');
      const submit = screen.getByTestId('set-new-submit');
      expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('falls back to a non-empty default message when the error has no message', async () => {
      await submitFailing(new Error(''));

      const alert = await screen.findByTestId('set-new-error');
      expect(alert.textContent?.trim()).not.toBe('');
    });

    it('shows no error element before any submit', async () => {
      await renderPage();

      expect(screen.queryByTestId('set-new-error')).not.toBeInTheDocument();
    });
  });
});
