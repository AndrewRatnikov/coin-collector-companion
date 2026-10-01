// One-shot flag that carries the "account deleted" notice across the redirect to `/`.
// sessionStorage (not localStorage) so it can never outlive the tab that deleted the account.
export const ACCOUNT_DELETED_NOTICE_KEY = 'ccc-account-deleted';

export function markAccountDeleted(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(ACCOUNT_DELETED_NOTICE_KEY, '1');
}

// Returns true at most once per mark: reading the flag also removes it.
export function consumeAccountDeletedNotice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const isSet = window.sessionStorage.getItem(ACCOUNT_DELETED_NOTICE_KEY) === '1';
  if (isSet) {
    window.sessionStorage.removeItem(ACCOUNT_DELETED_NOTICE_KEY);
  }
  return isSet;
}
