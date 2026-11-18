import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {/* config options here */};

export default withSentryConfig(nextConfig, {
  org: 'andrew-0p',
  project: 'coin-collector-web',
  // Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel build env); never commit it.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Only print source map upload logs in CI.
  silent: !process.env.CI,
});
