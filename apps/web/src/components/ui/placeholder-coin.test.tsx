/**
 * Tests for: PlaceholderCoin
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: PlaceholderCoin
 * Covers criteria: #7 (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PlaceholderCoin,
  getCoinTone,
  getDenominationUnit,
  type PlaceholderCoinSize,
} from '@/components/ui/placeholder-coin';

function renderCoin(over: Partial<React.ComponentProps<typeof PlaceholderCoin>> = {}) {
  return render(<PlaceholderCoin denomination="10 Hryvnias" material="Brass-plated steel" {...over} />);
}

describe('getCoinTone', () => {
  it('maps brass and gold-coloured alloys to gold', () => {
    expect(getCoinTone('Brass')).toBe('gold');
    expect(getCoinTone('Brass-plated steel')).toBe('gold');
    expect(getCoinTone('Aluminium bronze')).toBe('gold');
    expect(getCoinTone('Aluminum bronze')).toBe('gold');
    expect(getCoinTone('Nordic gold')).toBe('gold');
  });

  it('maps nickel, steel, aluminium and silver to silver', () => {
    expect(getCoinTone('Cupronickel')).toBe('silver');
    expect(getCoinTone('Nickel-plated steel')).toBe('silver');
    expect(getCoinTone('Stainless steel')).toBe('silver');
    expect(getCoinTone('Aluminium')).toBe('silver');
    expect(getCoinTone('Aluminum')).toBe('silver');
    expect(getCoinTone('Silver')).toBe('silver');
  });

  it('maps copper and bronze to copper', () => {
    expect(getCoinTone('Copper')).toBe('copper');
    expect(getCoinTone('Bronze')).toBe('copper');
    expect(getCoinTone('Bronze (95% copper, 5% tin and zinc)')).toBe('copper');
  });

  it('checks the groups in order: plated and alloy names win over the base metal', () => {
    // brass-plated beats steel, copper-plated beats steel, aluminium bronze beats aluminium
    expect(getCoinTone('Brass-plated steel')).toBe('gold');
    expect(getCoinTone('Copper-plated steel')).toBe('copper');
    expect(getCoinTone('Aluminium bronze')).toBe('gold');
    expect(getCoinTone('Steel')).toBe('silver');
  });

  it('is case-insensitive', () => {
    expect(getCoinTone('BRASS')).toBe('gold');
    expect(getCoinTone('silver')).toBe('silver');
    expect(getCoinTone('COPPER')).toBe('copper');
  });

  it('is unknown for null and for unrecognised materials', () => {
    expect(getCoinTone(null)).toBe('unknown');
    expect(getCoinTone('Zinc')).toBe('unknown');
    expect(getCoinTone('')).toBe('unknown');
  });
});

describe('getDenominationUnit', () => {
  it('removes the leading numeral and keeps the unit word', () => {
    expect(getDenominationUnit('10 Hryvnias')).toBe('Hryvnias');
    expect(getDenominationUnit('25 Kopiyok')).toBe('Kopiyok');
    expect(getDenominationUnit('1 Cent')).toBe('Cent');
  });

  it('keeps the whole text when there is no number to remove', () => {
    expect(getDenominationUnit('Cent')).toBe('Cent');
  });

  it('removes a decimal numeral as one piece', () => {
    expect(getDenominationUnit('0.5 Dollar')).toBe('Dollar');
  });

  it('collapses the whitespace left behind by the removed numeral', () => {
    expect(getDenominationUnit('Half 5 Cents')).toBe('Half Cent');
  });

  it('cuts the unit to 9 characters', () => {
    expect(getDenominationUnit('3 Kilometres')).toBe('Kilometre');
    expect(getDenominationUnit('3 Kilometres')).toHaveLength(9);
  });
});

describe('PlaceholderCoin', () => {
  it('renders an aria-hidden root with tone, size and missing data attributes', () => {
    renderCoin();
    const root = screen.getByTestId('placeholder-coin');

    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('data-tone', 'gold');
    expect(root).toHaveAttribute('data-size', '96');
    expect(root).toHaveAttribute('data-missing', 'false');
  });

  it('derives the tone from the material', () => {
    const { unmount } = renderCoin({ material: 'Cupronickel' });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-tone', 'silver');
    unmount();

    const second = renderCoin({ material: 'Copper' });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-tone', 'copper');
    second.unmount();

    renderCoin({ material: null });
    expect(screen.getByTestId('placeholder-coin')).toHaveAttribute('data-tone', 'unknown');
  });

  it('uses the metal fill and rim tokens for each tone', () => {
    const expected: Array<[string | null, string, string]> = [
      ['Brass', 'bg-gold-1', 'border-gold-2'],
      ['Silver', 'bg-silver-1', 'border-silver-2'],
      ['Copper', 'bg-copper-1', 'border-copper-2'],
      [null, 'bg-neutral-200', 'border-neutral-400'],
    ];
    for (const [material, fill, rim] of expected) {
      const { unmount } = renderCoin({ material });
      const html = screen.getByTestId('placeholder-coin').outerHTML;
      expect(html).toContain(fill);
      expect(html).toContain(rim);
      unmount();
    }
  });

  it('shows different fills for different tones', () => {
    const { unmount } = renderCoin({ material: 'Brass' });
    const gold = screen.getByTestId('placeholder-coin').outerHTML;
    unmount();
    renderCoin({ material: 'Silver' });
    const silver = screen.getByTestId('placeholder-coin').outerHTML;

    expect(gold).not.toContain('bg-silver-1');
    expect(silver).not.toContain('bg-gold-1');
  });

  it('shows the leading number of the denomination as the numeral', () => {
    renderCoin({ denomination: '10 Hryvnias' });
    expect(screen.getByTestId('placeholder-coin-numeral')).toHaveTextContent(/^10$/);
  });

  it('shows 1 for a denomination without a number, and the right number for another one', () => {
    const { unmount } = renderCoin({ denomination: 'Cent' });
    expect(screen.getByTestId('placeholder-coin-numeral')).toHaveTextContent(/^1$/);
    unmount();

    renderCoin({ denomination: '25 Kopiyok' });
    expect(screen.getByTestId('placeholder-coin-numeral')).toHaveTextContent(/^25$/);
  });

  it('sets the box and font size from the size prop', () => {
    const sizes: PlaceholderCoinSize[] = [28, 40, 72, 96, 180, 260];
    for (const size of sizes) {
      const { unmount } = renderCoin({ size });
      const root = screen.getByTestId('placeholder-coin');
      expect(root).toHaveAttribute('data-size', String(size));
      expect(root.outerHTML).toContain(`size-[${size}px]`);
      expect(root.outerHTML).toContain(`text-[${size}px]`);
      unmount();
    }
  });

  it('sizes the fluid coin from the container width', () => {
    renderCoin({ size: 'fluid' });
    const root = screen.getByTestId('placeholder-coin');

    expect(root).toHaveAttribute('data-size', 'fluid');
    expect(root.outerHTML).toContain('size-[54cqw]');
    expect(root.outerHTML).toContain('text-[54cqw]');
  });

  it('hides the unit label below 72px and shows it from 72px up and when fluid', () => {
    const hidden: PlaceholderCoinSize[] = [28, 40];
    for (const size of hidden) {
      const { unmount } = renderCoin({ size });
      expect(screen.queryByTestId('placeholder-coin-unit')).not.toBeInTheDocument();
      unmount();
    }
    const shown: PlaceholderCoinSize[] = [72, 96, 180, 260, 'fluid'];
    for (const size of shown) {
      const { unmount } = renderCoin({ size });
      expect(screen.getByTestId('placeholder-coin-unit')).toBeInTheDocument();
      unmount();
    }
  });

  it('shows the unit derived from the denomination', () => {
    renderCoin({ denomination: '25 Kopiyok', size: 96 });
    expect(screen.getByTestId('placeholder-coin-unit')).toHaveTextContent(/^Kopiyok$/);
  });

  it('keeps the numeral at every size, including the smallest', () => {
    renderCoin({ size: 28 });
    expect(screen.getByTestId('placeholder-coin-numeral')).toHaveTextContent('10');
  });

  it('marks a missing coin and fades it', () => {
    renderCoin({ missing: true });
    const root = screen.getByTestId('placeholder-coin');

    expect(root).toHaveAttribute('data-missing', 'true');
    expect(root.outerHTML).toContain('grayscale');
    expect(root.outerHTML).toContain('opacity-50');
  });

  it('does not fade a coin that is not missing', () => {
    renderCoin({ missing: false });
    const root = screen.getByTestId('placeholder-coin');

    expect(root).toHaveAttribute('data-missing', 'false');
    expect(root.outerHTML).not.toContain('grayscale');
    expect(root.outerHTML).not.toContain('opacity-50');
  });

  it('renders a photo instead of the numeral and unit when imageUrl is set', () => {
    renderCoin({ imageUrl: 'https://example.com/coin.jpg' });

    const image = screen.getByTestId('placeholder-coin-image');
    expect(image.tagName).toBe('IMG');
    expect(image).toHaveAttribute('src', 'https://example.com/coin.jpg');
    expect(image).toHaveAttribute('alt', '');
    expect(screen.queryByTestId('placeholder-coin-numeral')).not.toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-coin-unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('placeholder-coin')).toContainElement(image);
  });

  it('renders no photo when imageUrl is null or missing', () => {
    const { unmount } = renderCoin({ imageUrl: null });
    expect(screen.queryByTestId('placeholder-coin-image')).not.toBeInTheDocument();
    expect(screen.getByTestId('placeholder-coin-numeral')).toBeInTheDocument();
    unmount();

    renderCoin();
    expect(screen.queryByTestId('placeholder-coin-image')).not.toBeInTheDocument();
  });
});
