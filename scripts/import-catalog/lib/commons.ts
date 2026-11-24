import type { FetchLike, FetchResponseLike } from './generate';
import type { RawCoinImage } from './types';

// Wikimedia Commons API client for `pnpm run find-images`: one breadth-first crawl of a
// category tree, and imageinfo + extmetadata for a list of files in small batches.
// Requests are sent one at a time, each with the descriptive User-Agent that
// docs/catalog-data-licensing.md §1 requires, after a short pause (REQUEST_DELAY_MS) so
// Wikimedia's rate limiter isn't tripped. HTTP 429, 5xx and network failures are retried a
// few times with a capped wait. The sleep is injected (CommonsPacing.sleep): this module
// never waits on a real timer itself. No coin knowledge here.

export const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
export const ROOT_CATEGORY = 'Category:Coins of Ukraine';
export const MAX_CATEGORY_DEPTH = 4;
export const IMAGEINFO_BATCH_SIZE = 5;
export const THUMB_WIDTH = 500;

export const REQUEST_DELAY_MS = 1000; // pause before every request
export const MAX_ATTEMPTS = 4; // attempts per request, the first included
export const RETRY_BASE_DELAY_MS = 2000; // backoff 2000, 4000, 8000 …
export const MAX_RETRY_WAIT_MS = 60000; // cap on one wait; a longer Retry-After gives up

export type Sleep = (ms: number) => Promise<void>;

export interface CommonsPacing {
  sleep: Sleep;
  delayMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  maxRetryWaitMs?: number;
  onRetry?: (line: string) => void;
}

// Retry-After in integer seconds -> milliseconds. An HTTP-date or anything else is null,
// and the exponential backoff applies instead.
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed) * 1000;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

const EXTMETADATA_FIELDS = ['Artist', 'Credit', 'LicenseShortName', 'Copyrighted', 'AttributionRequired'];

const NS_FILE = 6;
const NS_CATEGORY = 14;

export class CommonsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommonsApiError';
  }
}

export interface CommonsFile {
  title: string;
  categories: string[];
}

export interface CommonsImageInfo {
  title: string;
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  mime: string;
  extmetadata: Record<string, string>;
}

export function buildCategoryMembersUrl(category: string, cont?: Record<string, string>): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'categorymembers',
    cmtitle: category,
    cmtype: 'subcat|file',
    cmlimit: '500',
  });
  if (cont) {
    for (const [key, value] of Object.entries(cont)) params.set(key, value);
  }
  return `${COMMONS_API_URL}?${params.toString()}`;
}

export function buildImageInfoUrl(titles: readonly string[]): string {
  if (titles.length === 0 || titles.length > IMAGEINFO_BATCH_SIZE) {
    throw new RangeError(`imageinfo takes 1 to ${IMAGEINFO_BATCH_SIZE} titles per request, got ${titles.length}`);
  }
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: EXTMETADATA_FIELDS.join('|'),
    titles: titles.join('|'),
  });
  return `${COMMONS_API_URL}?${params.toString()}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type Attempt = { body: string } | { failure: string; retryAfter: string | null };

// One attempt: a retryable failure (429, 5xx, a thrown fetch or body read) is returned,
// any other non-OK status throws at once.
async function attemptRequest(url: string, fetchFn: FetchLike, userAgent: string, what: string): Promise<Attempt> {
  let response: FetchResponseLike;
  try {
    response = await fetchFn(url, { headers: { 'User-Agent': userAgent } });
  } catch (err) {
    return { failure: errorMessage(err), retryAfter: null };
  }
  if (!response.ok) {
    const detail = `HTTP ${response.status} ${response.statusText}`.trim();
    if (isRetryableStatus(response.status)) {
      return { failure: detail, retryAfter: response.headers?.get('Retry-After') ?? null };
    }
    throw new CommonsApiError(`Commons API request for ${what} failed: ${detail}`);
  }
  try {
    return { body: await response.text() };
  } catch (err) {
    return { failure: errorMessage(err), retryAfter: null };
  }
}

// One awaited request, paced and retried (see CommonsPacing). After the last attempt, or
// when Commons asks for a longer wait than the cap, a CommonsApiError. A body that isn't
// JSON or carries an API `error` object is a CommonsApiError without retry.
async function requestJson(
  url: string,
  fetchFn: FetchLike,
  userAgent: string,
  what: string,
  pacing: CommonsPacing,
): Promise<unknown> {
  const delayMs = pacing.delayMs ?? REQUEST_DELAY_MS;
  const maxAttempts = pacing.maxAttempts ?? MAX_ATTEMPTS;
  const retryBaseDelayMs = pacing.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
  const maxRetryWaitMs = pacing.maxRetryWaitMs ?? MAX_RETRY_WAIT_MS;

  let wait = delayMs;
  for (let attempt = 1; ; attempt += 1) {
    await pacing.sleep(wait);
    const result = await attemptRequest(url, fetchFn, userAgent, what);
    if ('body' in result) return parseBody(result.body, what);
    const failed = `Commons API request for ${what} failed: ${result.failure}`;
    if (attempt >= maxAttempts) {
      throw new CommonsApiError(`${failed} (gave up after ${maxAttempts} attempts)`);
    }
    const asked = parseRetryAfter(result.retryAfter);
    if (asked !== null && asked > maxRetryWaitMs) {
      throw new CommonsApiError(
        `${failed}; Commons asked to wait ${asked / 1000} s, more than the ${maxRetryWaitMs / 1000} s limit`,
      );
    }
    wait = asked !== null ? Math.max(asked, delayMs) : Math.min(retryBaseDelayMs * 2 ** (attempt - 1), maxRetryWaitMs);
    pacing.onRetry?.(`${failed}; retrying in ${wait / 1000} s (attempt ${attempt + 1} of ${maxAttempts})`);
  }
}

function parseBody(body: string, what: string): unknown {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new CommonsApiError(`Commons API response for ${what} is not JSON`);
  }
  const data = (json ?? {}) as { error?: { code?: unknown; info?: unknown } };
  if (data.error && typeof data.error === 'object') {
    throw new CommonsApiError(`Commons API error for ${what}: ${String(data.error.code)}: ${String(data.error.info)}`);
  }
  return json;
}

interface CategoryMember {
  ns?: unknown;
  title?: unknown;
}

interface CategoryMembersResponse {
  continue?: Record<string, unknown>;
  query?: { categorymembers?: CategoryMember[] };
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Breadth-first over the category tree, one request at a time, following `continue`
// until it is absent. A file listed under several categories appears once, with every
// direct parent in discovery order. Cycles are ignored. Sorted by title.
export async function listCategoryFiles(
  fetchFn: FetchLike,
  userAgent: string,
  pacing: CommonsPacing,
  root: string = ROOT_CATEGORY,
  maxDepth: number = MAX_CATEGORY_DEPTH,
): Promise<CommonsFile[]> {
  const files = new Map<string, CommonsFile>();
  const visited = new Set<string>([root]);
  const queue: Array<{ category: string; depth: number }> = [{ category: root, depth: 0 }];

  while (queue.length > 0) {
    const { category, depth } = queue.shift() as { category: string; depth: number };
    let cont: Record<string, string> | undefined;
    do {
      const data = (await requestJson(
        buildCategoryMembersUrl(category, cont),
        fetchFn,
        userAgent,
        `"${category}"`,
        pacing,
      )) as CategoryMembersResponse;

      for (const member of data.query?.categorymembers ?? []) {
        if (typeof member.title !== 'string') continue;
        if (member.ns === NS_CATEGORY) {
          if (depth < maxDepth && !visited.has(member.title)) {
            visited.add(member.title);
            queue.push({ category: member.title, depth: depth + 1 });
          }
        } else if (member.ns === NS_FILE) {
          const known = files.get(member.title);
          if (!known) files.set(member.title, { title: member.title, categories: [category] });
          else if (!known.categories.includes(category)) known.categories.push(category);
        }
      }

      cont = undefined;
      if (data.continue && typeof data.continue === 'object') {
        cont = {};
        for (const [key, value] of Object.entries(data.continue)) cont[key] = String(value);
      }
    } while (cont);
  }

  return [...files.values()].sort((a, b) => compareStrings(a.title, b.title));
}

interface ImageInfoPage {
  title?: unknown;
  missing?: unknown;
  invalid?: unknown;
  imageinfo?: Array<{
    url?: unknown;
    thumburl?: unknown;
    width?: unknown;
    height?: unknown;
    mime?: unknown;
    extmetadata?: Record<string, { value?: unknown } | undefined>;
  }>;
}

function toImageInfo(page: ImageInfoPage): CommonsImageInfo | null {
  if (typeof page.title !== 'string' || page.missing || page.invalid) return null;
  const raw = page.imageinfo?.[0];
  if (!raw || typeof raw.url !== 'string') return null;

  const extmetadata: Record<string, string> = {};
  for (const [field, entry] of Object.entries(raw.extmetadata ?? {})) {
    const value = entry?.value;
    if (typeof value === 'string') extmetadata[field] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') extmetadata[field] = String(value);
  }

  return {
    title: page.title,
    url: raw.url,
    ...(typeof raw.thumburl === 'string' ? { thumburl: raw.thumburl } : {}),
    width: typeof raw.width === 'number' ? raw.width : 0,
    height: typeof raw.height === 'number' ? raw.height : 0,
    mime: typeof raw.mime === 'string' ? raw.mime : '',
    extmetadata,
  };
}

// Dedupes the titles (first-seen order), asks for at most IMAGEINFO_BATCH_SIZE per
// request and awaits each request before sending the next. Missing, invalid and
// info-less pages are left out. Keyed by page title.
export async function fetchImageInfo(
  titles: readonly string[],
  fetchFn: FetchLike,
  userAgent: string,
  pacing: CommonsPacing,
): Promise<Map<string, CommonsImageInfo>> {
  const unique = [...new Set(titles)];
  const infos = new Map<string, CommonsImageInfo>();
  for (let i = 0; i < unique.length; i += IMAGEINFO_BATCH_SIZE) {
    const batch = unique.slice(i, i + IMAGEINFO_BATCH_SIZE);
    const data = (await requestJson(
      buildImageInfoUrl(batch),
      fetchFn,
      userAgent,
      `imageinfo of ${batch.length} file(s)`,
      pacing,
    )) as { query?: { pages?: ImageInfoPage[] } };
    for (const page of data.query?.pages ?? []) {
      const info = toImageInfo(page);
      if (info) infos.set(info.title, info);
    }
  }
  return infos;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

// Tags are removed before entities are decoded, so `&lt;b&gt;` stays text.
export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => NAMED_ENTITIES[name])
    .replace(/&#(\d+);/g, (match, code: string) => {
      const n = Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code: string) => {
      const n = parseInt(code, 16);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseExtBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

// Artist comes before Credit: Credit is often just "Own work". Keys without a value are
// omitted; the key order is always url, source, license, copyrighted, attributionRequired.
export function toRawCoinImage(info: CommonsImageInfo): RawCoinImage {
  const meta = info.extmetadata;
  const source = stripHtml(meta.Artist ?? '') || stripHtml(meta.Credit ?? '') || null;
  const license = stripHtml(meta.LicenseShortName ?? '') || null;
  const copyrighted = parseExtBoolean(meta.Copyrighted);
  const attributionRequired = parseExtBoolean(meta.AttributionRequired);

  const image: RawCoinImage = { url: info.thumburl ?? info.url };
  if (source !== null) image.source = source;
  if (license !== null) image.license = license;
  if (copyrighted !== undefined) image.copyrighted = copyrighted;
  if (attributionRequired !== undefined) image.attributionRequired = attributionRequired;
  return image;
}
