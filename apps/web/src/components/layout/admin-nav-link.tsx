'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Role } from '@coin-collector/shared';
import { getCurrentUser } from '@/lib/auth-api';
import { useTranslation } from '@/lib/i18n/i18n-context';

const navLinkClassName =
  'text-[13px] text-[var(--color-text)] opacity-70 transition-opacity hover:text-[var(--color-accent)] hover:opacity-100';

// Rendered by SiteNav only for a logged-in visitor. Plain effect + state rather than
// react-query, so SiteNav keeps working without a QueryClientProvider. Hidden while the
// role is unknown, on error, and for non-admins. Showing the link is cosmetic: the API
// enforces the role on every admin request.
export function AdminNavLink() {
  const { t } = useTranslation();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (active) setRole(user.role);
      })
      .catch(() => {
        // Keep the link hidden; a failed /auth/me is handled elsewhere (apiFetch's 401 flow).
      });
    return () => {
      active = false;
    };
  }, []);

  if (role !== 'admin') {
    return null;
  }

  return (
    <Link href="/admin/submissions" data-testid="site-nav-admin-link" className={navLinkClassName}>
      {t('nav.admin')}
    </Link>
  );
}
