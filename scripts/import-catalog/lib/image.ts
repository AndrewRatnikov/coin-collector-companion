import type { RawCoinImage } from './types';

export interface CoinImageFields {
  imageUrl: string | null;
  imageSource: string | null;
  imageLicense: string | null;
}

const NO_IMAGE: CoinImageFields = { imageUrl: null, imageSource: null, imageLicense: null };

// Gate per docs/catalog-data-licensing.md §2: only import an image tagged
// `Copyrighted: "False"` (covers pd/public-domain-dedication) or
// `AttributionRequired: "false"` (covers CC0 and similar) — anything else
// (e.g. CC BY/BY-SA, which requires per-image attribution UI this app doesn't
// have) is skipped rather than imported with a license we can't satisfy.
export function toImageFields(image: RawCoinImage | null | undefined): CoinImageFields {
  if (!image) return NO_IMAGE;
  const clearedForImport = image.copyrighted === false || image.attributionRequired === false;
  if (!clearedForImport) return NO_IMAGE;

  return {
    imageUrl: image.url,
    imageSource: image.source ?? null,
    imageLicense: image.license ?? null,
  };
}
