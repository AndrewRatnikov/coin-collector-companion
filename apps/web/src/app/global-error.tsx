'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

// Catches render errors anywhere in the App Router and reports them to Sentry.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* The App Router exposes no status code here, so render the generic error page. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
