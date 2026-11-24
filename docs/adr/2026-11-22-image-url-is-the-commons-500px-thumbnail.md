# The stored image url is Commons' 500 px thumbnail, not the original file

- **Status:** Accepted
- **Date:** 2026-11-22
- **Source:** orchestrator run `run_20261122_084533` (images for the Ukrainian part of the catalog; the task's scope firewall said no re-hosting, `imageUrl` stays a Commons URL)
- **Code:** `scripts/import-catalog/lib/commons.ts`, `apps/web/src/components/ui/placeholder-coin.tsx`

## Context

The scope firewall forbids re-hosting: the catalog's `imageUrl` must stay a Commons URL that the web app hotlinks with a plain `<img>`. Commons originals are often several MB and sometimes TIFF or SVG, which browsers render poorly. They would be loaded into 40 px list thumbnails and card discs on a phone connection.

## Decision

`buildImageInfoUrl` sends `iiurlwidth=500` (`THUMB_WIDTH`), and `toRawCoinImage` writes `url: info.thumburl ?? info.url` into the fixture's `image` block. The URL is still on `upload.wikimedia.org`, so nothing is re-hosted. The licence fields (`source` from Artist, else Credit; `license` from LicenseShortName; `copyrighted`; `attributionRequired`) still describe the file and go through the unchanged `toImageFields` gate. On the web side the only change is that `PlaceholderCoin` marks the photo `loading="lazy"` and `decoding="async"`.

## Alternatives considered

- **Store the original file URL.** Rejected: heavy downloads on phones and formats a browser may not draw.

## Consequences

- Lists, cards and the coin page load a small image; no web host configuration or image proxy is needed.
- The 500 px image is slightly upscaled on the coin page plate on high-DPI desktop screens; accepted for v1.
- If Commons changes its thumbnail URL scheme, stored URLs can break. A file with no `thumburl` falls back to the original URL.
- Re-hosting is still a separate, later decision.
