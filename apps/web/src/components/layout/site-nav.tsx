'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearStoredToken, getStoredToken } from '@/lib/auth-token';

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(getStoredToken()));
  }, [pathname]);

  function handleLogout() {
    clearStoredToken();
    setIsAuthenticated(false);
    router.push('/login');
  }

  return (
    <nav
      data-testid="site-nav"
      className="flex items-center justify-between gap-4 border-b border-gray-200 px-8 py-4 text-sm dark:border-gray-800"
    >
      <div className="flex items-center gap-4">
        <Link href="/catalog" data-testid="site-nav-catalog-link" className="hover:underline">
          Catalog
        </Link>
        <Link href="/sets/canonical" data-testid="site-nav-canonical-link" className="hover:underline">
          Canonical sets
        </Link>
        <Link href="/sets/public" data-testid="site-nav-public-link" className="hover:underline">
          Public sets
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link href="/dashboard" data-testid="site-nav-dashboard-link" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/collection" data-testid="site-nav-collection-link" className="hover:underline">
              Collection
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              data-testid="site-nav-logout"
              className="hover:underline"
            >
              Log out
            </button>
          </>
        ) : (
          <Link href="/login" data-testid="site-nav-login-link" className="hover:underline">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
