import type { Locale } from './types';

export function resolveLocalizedText(
  value: string,
  locale: Locale,
  overrides?: Partial<Record<Locale, string>>,
): string {
  return overrides?.[locale] ?? value;
}
