/**
 * Tests for: SettingsTabs
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Component: SettingsTabs (CREATE)
 * Covers criteria: #1 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * next/navigation's usePathname is mocked directly (no Link/router mocking needed beyond
 * that), same convention as apps/web/src/components/layout/site-nav.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsTabs } from '@/components/layout/settings-tabs';

const usePathnameMock = vi.fn(() => '/settings');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('SettingsTabs', () => {
  beforeEach(() => {
    usePathnameMock.mockClear();
    usePathnameMock.mockReturnValue('/settings');
  });

  describe('rendering', () => {
    it('renders the tabs root and both tab links', () => {
      render(<SettingsTabs />);
      expect(screen.getByTestId('settings-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-account')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-feedback')).toBeInTheDocument();
    });

    it('links to /settings and /settings/feedback respectively', () => {
      render(<SettingsTabs />);
      expect(screen.getByTestId('settings-tab-account')).toHaveAttribute('href', '/settings');
      expect(screen.getByTestId('settings-tab-feedback')).toHaveAttribute('href', '/settings/feedback');
    });
  });

  describe('criterion #1: active-tab detection is exact-match, not prefix-match', () => {
    it('marks only the account tab active on /settings (not the feedback tab, even though /settings is a prefix of /settings/feedback)', () => {
      usePathnameMock.mockReturnValue('/settings');
      render(<SettingsTabs />);
      expect(screen.getByTestId('settings-tab-account')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('settings-tab-feedback')).not.toHaveAttribute('aria-current');
    });

    it('marks only the feedback tab active on /settings/feedback', () => {
      usePathnameMock.mockReturnValue('/settings/feedback');
      render(<SettingsTabs />);
      expect(screen.getByTestId('settings-tab-feedback')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('settings-tab-account')).not.toHaveAttribute('aria-current');
    });
  });
});
