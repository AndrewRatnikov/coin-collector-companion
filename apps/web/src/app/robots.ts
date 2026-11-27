import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-url';

/**
 * The crawler policy, in one place. Every crawler may read the public site; the signed-in and
 * auth-only paths are disallowed. The AI search, user-triggered and training crawlers get an
 * explicit group each so the policy is visible and easy to change per bot. Each named group
 * repeats the disallow list because a crawler follows only its most specific matching group,
 * not the `*` group. To block one bot, give its group `disallow: '/'`.
 */
const AI_CRAWLER_USER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
] as const;

const DISALLOWED_PATHS = [
  '/dashboard',
  '/collection',
  '/want-list',
  '/settings',
  '/admin',
  '/sets/new',
  '/sets/*/missing',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...DISALLOWED_PATHS] },
      ...AI_CRAWLER_USER_AGENTS.map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: [...DISALLOWED_PATHS],
      })),
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
