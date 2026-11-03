/**
 * Tests for: GradeChip
 * Contract source: runs/run_20261102_220909/plan.md § Interface Contract → Component: GradeChip
 * Covers criteria: #7, #9
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { COIN_GRADES } from '@coin-collector/shared';
import { GradeChip } from '@/components/ui/grade-chip';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

beforeEach(() => {
  localStorage.clear();
});

describe('GradeChip (EN)', () => {
  it('renders an abbr with the short code as text and the full name as title', () => {
    render(<GradeChip grade="VF" />);
    const chip = screen.getByTestId('grade-chip');

    expect(chip.tagName).toBe('ABBR');
    expect(chip).toHaveTextContent(/^VF$/);
    expect(chip).toHaveAttribute('title', 'Very Fine');
    expect(chip).toHaveAttribute('data-grade', 'VF');
  });

  it('shows different text, title and data-grade for a different grade', () => {
    render(<GradeChip grade="AU" />);
    const chip = screen.getByTestId('grade-chip');

    expect(chip).toHaveTextContent(/^AU$/);
    expect(chip).toHaveAttribute('title', 'About Uncirculated');
    expect(chip).toHaveAttribute('data-grade', 'AU');
  });

  it('renders every grade with its own code', () => {
    for (const g of COIN_GRADES) {
      const { unmount } = render(<GradeChip grade={g} />);
      expect(screen.getByTestId('grade-chip')).toHaveTextContent(new RegExp(`^${g}$`));
      expect(screen.getByTestId('grade-chip')).toHaveAttribute('data-grade', g);
      unmount();
    }
  });

  it('uses the given testId instead of the default', () => {
    render(<GradeChip grade="F" testId="coin-card-grade" />);
    expect(screen.getByTestId('coin-card-grade')).toHaveTextContent('F');
    expect(screen.queryByTestId('grade-chip')).not.toBeInTheDocument();
  });

  it('adds the className', () => {
    render(<GradeChip grade="F" className="extra-class" />);
    expect(screen.getByTestId('grade-chip').className).toContain('extra-class');
  });
});

describe('GradeChip (ES)', () => {
  it('shows the Spanish abbreviation and the Spanish name as title', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <GradeChip grade="VF" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('grade-chip')).toHaveTextContent(/^MBC$/);
    });
    expect(screen.getByTestId('grade-chip')).toHaveAttribute('title', 'Muy bien conservada');
    expect(screen.getByTestId('grade-chip')).toHaveAttribute('data-grade', 'VF');
  });

  it('maps UNC to SC and AU to EBC+', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <GradeChip grade="UNC" />
        <GradeChip grade="AU" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('grade-chip')[0]).toHaveTextContent(/^SC$/);
    });
    expect(screen.getAllByTestId('grade-chip')[1]).toHaveTextContent(/^EBC\+$/);
  });
});
