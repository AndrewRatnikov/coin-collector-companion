'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken } from '@/lib/auth-token';
import { Skeleton } from '@/components/ui/skeleton';

type AuthStatus = 'checking' | 'authorized' | 'redirecting';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    if (getStoredToken()) {
      setStatus('authorized');
    } else {
      setStatus('redirecting');
      router.replace('/login');
    }
  }, [router]);

  if (status === 'authorized') {
    return <>{children}</>;
  }

  return (
    <div data-testid="require-auth-pending">
      <Skeleton />
    </div>
  );
}
