import * as Sentry from '@sentry/nextjs';

// Without NEXT_PUBLIC_SENTRY_DSN the SDK stays disabled (tests, CI, local runs without it).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Every trace in dev, 10% in production.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  integrations: [Sentry.replayIntegration()],
  // Replay 10% of sessions, and every session that hits an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
