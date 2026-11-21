import * as Sentry from '@sentry/nextjs';
import { initAnalytics } from '@/lib/analytics';
import { SENTRY_DATA_COLLECTION } from '@/lib/sentry-data-collection';

// Without NEXT_PUBLIC_SENTRY_DSN the SDK stays disabled (tests, CI, local runs without it).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Every trace in dev, 10% in production.
  dataCollection: SENTRY_DATA_COLLECTION,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  // Replays must not record what users type or see: mask all text and inputs, block media.
  integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
  // Replay 10% of sessions, and every session that hits an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Cookieless product analytics; stays off without NEXT_PUBLIC_POSTHOG_TOKEN.
void initAnalytics();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
