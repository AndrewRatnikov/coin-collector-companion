/**
 * Turns NEXT_PUBLIC_SITE_URL into the root layout's `metadataBase`, the absolute base Next uses
 * for Open Graph / Twitter image URLs. Returns undefined (leave Next's default) when the value is
 * unset, blank, not an absolute URL, or not http(s), so a bad value never breaks the build.
 */
export function siteMetadataBase(raw: string | undefined): URL | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined;
  }
  return url;
}

/** Used for absolute URLs when NEXT_PUBLIC_SITE_URL is unset or invalid (dev and tests). */
export const DEFAULT_SITE_ORIGIN = 'http://localhost:3000';

/**
 * The site origin for absolute URLs (robots, sitemap, llms.txt, JSON-LD): NEXT_PUBLIC_SITE_URL's
 * origin, read per call, without a trailing slash or path. Falls back to DEFAULT_SITE_ORIGIN.
 */
export function siteOrigin(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return siteMetadataBase(raw)?.origin ?? DEFAULT_SITE_ORIGIN;
}
