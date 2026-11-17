// Sentry must initialise before any other module is imported, so main.ts imports this file
// first. ConfigModule loads .env later (during module init), so load it here for SENTRY_DSN
// in local dev. On Render the variables are already in the environment and there is no .env.
import { existsSync } from 'node:fs';
import * as Sentry from '@sentry/nestjs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Render sets RENDER=true but not NODE_ENV, so check both.
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// Without SENTRY_DSN the SDK stays disabled (tests, CI, local runs without the variable).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? (isProduction ? 'production' : 'development'),
  release: process.env.RENDER_GIT_COMMIT,
  // Every trace locally, 10% in production.
  tracesSampleRate: isProduction ? 0.1 : 1.0,
});
