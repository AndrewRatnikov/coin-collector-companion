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
