'use client';

import Link from 'next/link';
import type { Role } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';

const defaultClassName =
  'flex h-10 items-center gap-2.5 px-3.5 text-[13px] text-[var(--color-text)] outline-none hover:bg-[var(--color-neutral-100)] focus-visible:bg-[var(--color-neutral-100)]';

export interface AdminNavLinkProps {
  role: Role | null | undefined;
  className?: string;
}

// The Admin item of the account menu. Presentational: SiteNav fetches the current user
// once and passes the role down. Hidden while the role is unknown, on error, and for
// non-admins. Showing the item is cosmetic: the API enforces the role on every admin
// request.
export function AdminNavLink({ role, className }: AdminNavLinkProps) {
  const { t } = useTranslation();

  if (role !== 'admin') {
    return null;
  }

  return (
    <Link
      href="/admin/submissions"
      role="menuitem"
      data-testid="site-nav-admin-link"
      className={className ?? defaultClassName}
    >
      {t('nav.admin')}
    </Link>
  );
}
