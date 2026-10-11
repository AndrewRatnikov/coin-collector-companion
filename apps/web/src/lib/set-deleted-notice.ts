// One-shot flag that carries the "set deleted" notice across the redirect to `/dashboard`.
// sessionStorage (not localStorage) so it can never outlive the tab that deleted the set.
// Same pattern as `account-deleted-notice.ts`, but the stored value is the set's name.
export const SET_DELETED_NOTICE_KEY = 'ccc-set-deleted';

export function markSetDeleted(name: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(SET_DELETED_NOTICE_KEY, name);
}

// Returns the deleted set's name at most once per mark: reading the flag also removes it.
export function consumeSetDeletedNotice(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.sessionStorage.getItem(SET_DELETED_NOTICE_KEY);
  if (stored === null) {
    return null;
  }
  window.sessionStorage.removeItem(SET_DELETED_NOTICE_KEY);
  return stored.length > 0 ? stored : null;
}
