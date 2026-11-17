/**
 * Markup-parity safeguard: the Legacy* components below are verbatim copies of the private icons
 * that lived in sets/[id]/page.tsx and sets/add-coins-sheet.tsx before the shared icons existed.
 */
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon, SearchIcon } from './icons';

// Legacy copy: sets/[id]/page.tsx
function LegacySetPagePlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// Legacy copy: sets/[id]/page.tsx
function LegacyAlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none text-danger">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

// Legacy copy: components/sets/add-coins-sheet.tsx
function LegacyCloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// Legacy copy: components/sets/add-coins-sheet.tsx
function LegacySearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700"
    >
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m12 12 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Legacy copy: components/sets/add-coins-sheet.tsx
function LegacySheetPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// Legacy copy: components/sets/add-coins-sheet.tsx
function LegacyCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function html(element: ReactElement): string {
  const { container, unmount } = render(element);
  const markup = container.innerHTML;
  unmount();
  return markup;
}

describe('shared icons render the same markup as the old private copies', () => {
  it('PlusIcon matches the set page copy', () => {
    expect(html(<PlusIcon />)).toBe(html(<LegacySetPagePlusIcon />));
  });

  it('PlusIcon matches the add-coins-sheet copy', () => {
    expect(html(<PlusIcon />)).toBe(html(<LegacySheetPlusIcon />));
  });

  it('AlertIcon with the call-site class matches the set page copy', () => {
    expect(html(<AlertIcon className="flex-none text-danger" />)).toBe(html(<LegacyAlertIcon />));
  });

  it('CloseIcon matches the add-coins-sheet copy', () => {
    expect(html(<CloseIcon />)).toBe(html(<LegacyCloseIcon />));
  });

  it('SearchIcon with the call-site class matches the add-coins-sheet copy', () => {
    expect(
      html(<SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />),
    ).toBe(html(<LegacySearchIcon />));
  });

  it('CheckIcon matches the add-coins-sheet copy', () => {
    expect(html(<CheckIcon />)).toBe(html(<LegacyCheckIcon />));
  });

  it('the icons are distinct from each other (the comparison is not vacuous)', () => {
    expect(html(<PlusIcon />)).not.toBe(html(<CheckIcon />));
    expect(html(<CloseIcon />)).not.toBe(html(<AlertIcon />));
  });
});

describe('icon className handling', () => {
  it('PlusIcon without className renders an svg with no class attribute', () => {
    const { container } = render(<PlusIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.hasAttribute('class')).toBe(false);
    expect(container.innerHTML).not.toContain('class=');
  });

  it('a passed className lands on the svg', () => {
    const { container } = render(<CheckIcon className="text-accent" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('text-accent');
  });

  it('icons are aria-hidden', () => {
    const { container } = render(<CloseIcon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
