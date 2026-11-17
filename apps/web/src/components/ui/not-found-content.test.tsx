/**
 * Tests for: NotFoundContent
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Component: NotFoundContent
 * Covers criteria: #1, #2, #3
 *
 * Signed-in state is read from the real getStoredToken (localStorage key 'ccc-auth-token') in a
 * mount effect, so the my-sets link is awaited with findByTestId.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { NotFoundContent } from '@/components/ui/not-found-content';
import type { NotFoundVariant } from '@/components/ui/not-found-content';
import { setStoredToken } from '@/lib/auth-token';

const COPY: ReadonlyArray<readonly [NotFoundVariant, string, string]> = [
  [
    'page',
    'Page not found',
    "We couldn't find the page you were looking for. The link may be wrong or the page may have moved.",
  ],
  ['coin', "This coin isn't in the catalog", 'It may have been removed, or the link may be wrong.'],
  ['set', "This set doesn't exist or was deleted", 'Check the link, or find another set to collect.'],
  ['checklist', "This checklist doesn't exist", 'Check the link, or pick another checklist.'],
];

describe('NotFoundContent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('variants', () => {
    it.each(COPY)('variant "%s" shows its heading and body and exposes data-variant', (variant, title, body) => {
      render(<NotFoundContent variant={variant} />);

      expect(screen.getByTestId('not-found')).toHaveAttribute('data-variant', variant);
      const heading = screen.getByTestId('not-found-title');
      expect(heading.tagName).toBe('H1');
      expect(heading).toHaveTextContent(title);
      expect(screen.getByTestId('not-found-body')).toHaveTextContent(body);
    });

    it('shows different headings for different variants', () => {
      const { unmount } = render(<NotFoundContent variant="coin" />);
      const coinTitle = screen.getByTestId('not-found-title').textContent;
      unmount();
      render(<NotFoundContent variant="set" />);
      expect(screen.getByTestId('not-found-title').textContent).not.toBe(coinTitle);
    });
  });

  describe('links, signed out', () => {
    it('shows exactly the catalog and checklists links with the right hrefs', async () => {
      render(<NotFoundContent variant="page" />);

      const links = screen.getByTestId('not-found-links');
      expect(within(links).getAllByRole('link')).toHaveLength(2);
      expect(screen.getByTestId('not-found-catalog-link')).toHaveAttribute('href', '/catalog');
      expect(screen.getByTestId('not-found-catalog-link')).toHaveTextContent('Browse the catalog');
      expect(screen.getByTestId('not-found-checklists-link')).toHaveAttribute('href', '/sets');
      expect(screen.getByTestId('not-found-checklists-link')).toHaveTextContent('Checklists');
      // give the mount effect a chance to run, then confirm the link is still absent
      await waitFor(() => {
        expect(screen.getByTestId('not-found')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('not-found-my-sets-link')).not.toBeInTheDocument();
    });
  });

  describe('links, signed in', () => {
    it('adds the My sets link to /dashboard after mount and keeps the other two', async () => {
      setStoredToken('tok-abc');
      render(<NotFoundContent variant="set" />);

      const mySets = await screen.findByTestId('not-found-my-sets-link');
      expect(mySets).toHaveAttribute('href', '/dashboard');
      expect(mySets).toHaveTextContent('My sets');
      expect(within(screen.getByTestId('not-found-links')).getAllByRole('link')).toHaveLength(3);
      expect(screen.getByTestId('not-found-catalog-link')).toHaveAttribute('href', '/catalog');
      expect(screen.getByTestId('not-found-checklists-link')).toHaveAttribute('href', '/sets');
    });
  });
});
