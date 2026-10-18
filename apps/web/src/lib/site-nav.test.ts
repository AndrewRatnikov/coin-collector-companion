/**
 * Tests for: site-nav helpers
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Module: site-nav helpers
 * Covers criteria: #1, #3, #7, #10 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it } from 'vitest';
import {
  getAccountDisplayName,
  getActiveNavItem,
  getAvatarInitial,
  getMobilePageAction,
  getMobilePageTitleKey,
} from '@/lib/site-nav';

describe('getActiveNavItem (signed in)', () => {
  it.each([
    ['/dashboard', 'my-sets'],
    ['/sets', 'my-sets'],
    ['/sets/canonical', 'my-sets'],
    ['/sets/new', 'my-sets'],
    ['/collection', 'collection'],
    ['/collection/import', 'collection'],
    ['/catalog', 'catalog'],
    ['/catalog/123', 'catalog'],
    ['/catalog/mine', 'catalog'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(getActiveNavItem(pathname, true)).toBe(expected);
  });

  it.each(['/', '/glossary', '/settings', '/admin/submissions', '/collectionx', '/catalogue'])(
    'returns null for %s',
    (pathname) => {
      expect(getActiveNavItem(pathname, true)).toBeNull();
    },
  );

  it('treats a null pathname as no match', () => {
    expect(getActiveNavItem(null, true)).toBeNull();
  });
});

describe('getActiveNavItem (signed out)', () => {
  it.each([
    ['/catalog', 'catalog'],
    ['/catalog/123', 'catalog'],
    ['/sets', 'checklists'],
    ['/sets/public', 'checklists'],
    ['/sets/canonical/abc', 'checklists'],
    ['/glossary', 'glossary'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(getActiveNavItem(pathname, false)).toBe(expected);
  });

  it.each(['/', '/dashboard', '/collection', '/login'])('returns null for %s', (pathname) => {
    expect(getActiveNavItem(pathname, false)).toBeNull();
  });

  it('treats a null pathname as no match', () => {
    expect(getActiveNavItem(null, false)).toBeNull();
  });

  it('gives different answers for the same path depending on auth state', () => {
    expect(getActiveNavItem('/sets', true)).not.toBe(getActiveNavItem('/sets', false));
  });
});

describe('getMobilePageTitleKey', () => {
  it.each([
    ['/dashboard', 'nav.mySets'],
    ['/collection', 'nav.collection'],
    ['/collection/import', 'nav.collection'],
    ['/catalog', 'nav.catalog'],
    ['/catalog/123', 'nav.catalog'],
    ['/sets/canonical', 'nav.checklists'],
    ['/sets/public', 'nav.checklists'],
    ['/sets/new', 'setNew.title'],
    ['/sets', 'nav.mySets'],
    ['/settings', 'nav.settings'],
    ['/settings/feedback', 'nav.settings'],
    ['/glossary', 'nav.glossary'],
    ['/admin/submissions', 'nav.admin'],
    ['/something-else', 'nav.brand'],
    ['/', 'nav.brand'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(getMobilePageTitleKey(pathname)).toBe(expected);
  });

  it('falls back to the brand for a null pathname', () => {
    expect(getMobilePageTitleKey(null)).toBe('nav.brand');
  });
});

describe('getMobilePageAction', () => {
  it('returns the New set action on exactly /dashboard', () => {
    expect(getMobilePageAction('/dashboard')).toEqual({ href: '/sets/new', labelKey: 'setNew.title' });
  });

  it.each(['/collection', '/dashboard/x', '/sets/new', '/', '/catalog'])('returns null for %s', (pathname) => {
    expect(getMobilePageAction(pathname)).toBeNull();
  });

  it('returns null for a null pathname', () => {
    expect(getMobilePageAction(null)).toBeNull();
  });
});

describe('getAccountDisplayName', () => {
  it('uses the email local part when there is no name', () => {
    expect(getAccountDisplayName({ email: 'collector@example.com' })).toBe('collector');
    expect(getAccountDisplayName({ email: 'zed@example.com' })).toBe('zed');
  });

  it('uses the local part when name is null or blank', () => {
    expect(getAccountDisplayName({ email: 'collector@example.com', name: null })).toBe('collector');
    expect(getAccountDisplayName({ email: 'collector@example.com', name: '   ' })).toBe('collector');
  });

  it('prefers a trimmed name when present', () => {
    expect(getAccountDisplayName({ email: 'collector@example.com', name: '  andrew  ' })).toBe('andrew');
  });

  it('uses the whole value when the email has no @', () => {
    expect(getAccountDisplayName({ email: 'nobody' })).toBe('nobody');
  });

  it('cuts at the first @ only', () => {
    expect(getAccountDisplayName({ email: 'a@b@c.com' })).toBe('a');
  });
});

describe('getAvatarInitial', () => {
  it('upper-cases the first letter of the email local part', () => {
    expect(getAvatarInitial({ email: 'collector@example.com' })).toBe('C');
    expect(getAvatarInitial({ email: 'zed@example.com' })).toBe('Z');
  });

  it('uses the name when present', () => {
    expect(getAvatarInitial({ email: 'collector@example.com', name: 'andrew' })).toBe('A');
  });
});
