import * as Sentry from '@sentry/nextjs';
import { SENTRY_DATA_COLLECTION } from '@/lib/sentry-data-collection';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Every trace in dev, 10% in production.
  dataCollection: SENTRY_DATA_COLLECTION,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
