/**
 * Tests for: resolveLocalizedText
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: translation-ready field lookup
 * Covers criteria: #6 (from prd.md)
 */

import { describe, expect, it } from 'vitest';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

describe('resolveLocalizedText', () => {
  describe('criterion 6: catalog data stays unchanged until an override exists', () => {
    it('returns the original value when no overrides argument is given', () => {
      expect(resolveLocalizedText('Lincoln Wheat Cent', 'es')).toBe('Lincoln Wheat Cent');
    });

    it('returns the original value when overrides has no entry for the requested locale', () => {
      expect(resolveLocalizedText('Lincoln Wheat Cent', 'es', {})).toBe('Lincoln Wheat Cent');
    });

    it('returns the original value for locale "en" even when an "es" override exists', () => {
      expect(
        resolveLocalizedText('Lincoln Wheat Cent', 'en', { es: 'Centavo de Trigo Lincoln' }),
      ).toBe('Lincoln Wheat Cent');
    });
  });

  describe('criterion 6: a future localized override is preferred when present', () => {
    it('returns the overrides[locale] value when one exists for the requested locale', () => {
      expect(
        resolveLocalizedText('Lincoln Wheat Cent', 'es', { es: 'Centavo de Trigo Lincoln' }),
      ).toBe('Centavo de Trigo Lincoln');
    });
  });
});
