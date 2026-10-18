/**
 * Tests for: NextSetSuggestion
 * Contract source: runs/run_20261018_105617/plan.md § Interface Contract → Component: NextSetSuggestion
 * Covers criteria: #7 (suggestion text and link) (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SuggestedCanonicalSet } from '@coin-collector/shared';
import { NextSetSuggestion } from '@/components/dashboard/next-set-suggestion';

const SUGGESTION: SuggestedCanonicalSet = {
  id: 'cs-1',
  name: 'Ukraine circulation coins',
  coinCount: 40,
  ownedCount: 7,
};

describe('NextSetSuggestion', () => {
  it('shows the eyebrow and the checklist name', () => {
    render(<NextSetSuggestion suggestion={SUGGESTION} />);

    expect(screen.getByTestId('dashboard-suggestion')).toHaveTextContent('A good next set');
    expect(screen.getByTestId('dashboard-suggestion-name')).toHaveTextContent('Ukraine circulation coins');
  });

  it('says how many coins the checklist has and how many the collector already owns', () => {
    render(<NextSetSuggestion suggestion={SUGGESTION} />);

    const body = screen.getByTestId('dashboard-suggestion-body');
    expect(body).toHaveTextContent('40 coins.');
    expect(body).toHaveTextContent('You already own 7 of them');
    expect(body).toHaveTextContent('ownership carries across sets');
  });

  it('derives the numbers and name from the suggestion (a different one gives different text)', () => {
    render(<NextSetSuggestion suggestion={{ id: 'cs-2', name: 'Lincoln Wheat Cents', coinCount: 187, ownedCount: 12 }} />);

    expect(screen.getByTestId('dashboard-suggestion-name')).toHaveTextContent('Lincoln Wheat Cents');
    expect(screen.getByTestId('dashboard-suggestion-body')).toHaveTextContent('187 coins.');
    expect(screen.getByTestId('dashboard-suggestion-body')).toHaveTextContent('You already own 12 of them');
    expect(screen.getByTestId('dashboard-suggestion-body')).not.toHaveTextContent('You already own 7 of them');
  });

  it('links "Start this set" to the new-set flow with the checklist preselected', () => {
    render(<NextSetSuggestion suggestion={SUGGESTION} />);

    const cta = screen.getByTestId('dashboard-suggestion-cta');
    expect(cta.tagName).toBe('A');
    expect(cta).toHaveTextContent('Start this set');
    expect(cta).toHaveAttribute('href', '/sets/new?cloneFrom=canonical&cloneFromId=cs-1');
  });

  it('puts the suggested checklist id in the link', () => {
    render(<NextSetSuggestion suggestion={{ ...SUGGESTION, id: 'cs-99' }} />);

    expect(screen.getByTestId('dashboard-suggestion-cta')).toHaveAttribute(
      'href',
      '/sets/new?cloneFrom=canonical&cloneFromId=cs-99',
    );
  });
});
