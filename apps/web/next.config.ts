import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  // PostHog's /relay proxy requests end in slashes; don't redirect them.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Same rule as analyticsRegion() in src/lib/analytics.ts: 'us' only when asked for, else 'eu'.
    // Read at call time; this file can't import from src/.
    const region = process.env.NEXT_PUBLIC_POSTHOG_REGION?.trim().toLowerCase() === 'us' ? 'us' : 'eu';
    return [
      { source: '/relay/static/:path*', destination: `https://${region}-assets.i.posthog.com/static/:path*` },
      { source: '/relay/array/:path*', destination: `https://${region}-assets.i.posthog.com/array/:path*` },
      { source: '/relay/:path*', destination: `https://${region}.i.posthog.com/:path*` },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'andrew-0p',
  project: 'coin-collector-web',
  // Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel build env); never commit it.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Only print source map upload logs in CI.
  silent: !process.env.CI,
});
