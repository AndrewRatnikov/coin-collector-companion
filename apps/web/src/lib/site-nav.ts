import type { MessageKey } from '@/lib/i18n/locales/en';

// Pure route/label helpers for the site chrome (SiteNav, MobileTabBar, AccountMenu).
// No React here, so every mapping is unit-testable on its own.

export type NavItemId = 'my-sets' | 'collection' | 'catalog' | 'checklists' | 'glossary';

export interface MobilePageAction {
  href: string;
  labelKey: MessageKey;
}

export interface NavUserLike {
  email: string;
  name?: string | null;
}

// Segment-aware: `/collection` matches `/collection` and `/collection/import`, never
// `/collectionx`.
function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function getActiveNavItem(pathname: string | null, isAuthenticated: boolean): NavItemId | null {
  const path = pathname ?? '';

  if (isAuthenticated) {
    // Own sets, the new-set form and the checklist browse pages are all reached from My sets.
    if (matches(path, '/dashboard') || matches(path, '/sets')) return 'my-sets';
    if (matches(path, '/collection')) return 'collection';
    if (matches(path, '/catalog')) return 'catalog';
    return null;
  }

  if (matches(path, '/catalog')) return 'catalog';
  if (matches(path, '/sets')) return 'checklists';
  if (matches(path, '/glossary')) return 'glossary';
  return null;
}

// First match wins, so the more specific `/sets/*` entries sit before `/sets`.
const MOBILE_TITLES: { base: string; key: MessageKey }[] = [
  { base: '/dashboard', key: 'nav.mySets' },
  { base: '/collection', key: 'nav.collection' },
  { base: '/catalog', key: 'nav.catalog' },
  { base: '/sets/canonical', key: 'nav.checklists' },
  { base: '/sets/public', key: 'nav.checklists' },
  { base: '/sets/new', key: 'setNew.title' },
  { base: '/sets', key: 'nav.mySets' },
  { base: '/settings', key: 'nav.settings' },
  { base: '/glossary', key: 'nav.glossary' },
  { base: '/admin', key: 'nav.admin' },
];

export function getMobilePageTitleKey(pathname: string | null): MessageKey {
  const path = pathname ?? '';
  const entry = MOBILE_TITLES.find(({ base }) => matches(path, base));
  return entry ? entry.key : 'nav.brand';
}

export function getMobilePageAction(pathname: string | null): MobilePageAction | null {
  if (pathname === '/dashboard') {
    return { href: '/sets/new', labelKey: 'setNew.title' };
  }
  return null;
}

// `User` has no name column yet, so the email local part stands in; a future `name`
// field takes precedence once it exists.
export function getAccountDisplayName(user: NavUserLike): string {
  const name = user.name?.trim();
  if (name) return name;
  const at = user.email.indexOf('@');
  return at === -1 ? user.email : user.email.slice(0, at);
}

export function getAvatarInitial(user: NavUserLike): string {
  return getAccountDisplayName(user).charAt(0).toUpperCase();
}
