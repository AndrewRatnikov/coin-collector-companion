import enLanding from '@/lib/i18n/locales/en/landing';
import { siteOrigin } from '@/lib/site-url';

/**
 * schema.org WebSite structured data for the landing page. No SearchAction: the catalog page
 * filters by `name`, not `q`. No hooks and no 'use client', so it renders on the server with
 * the page.
 */
export function buildWebsiteJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Coin Collector Companion',
    url: `${origin}/`,
    description: enLanding['landing.metaDescription'],
  };
}

/** JSON for a script tag: `<` is escaped so data can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function WebsiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      data-testid="website-json-ld"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildWebsiteJsonLd(siteOrigin())) }}
    />
  );
}
