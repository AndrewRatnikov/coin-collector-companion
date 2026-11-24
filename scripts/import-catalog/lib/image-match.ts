import { toRawCoinImage } from './commons';
import type { CommonsFile, CommonsImageInfo } from './commons';
import { toImageFields } from './image';
import type { RawCoinEntry, RawCoinImage, RawFixtureFile } from './types';

// Pure matching rules for `pnpm run find-images` (README "Finding images", rules M1-M8).
// A wrong picture is worse than none: a coin only gets a file that names its
// denomination, year and (where needed) subject, that is a single side, and that passes
// the licence gate in ./image. Everything else is listed for a human.

export const MIN_ASPECT = 0.8;
export const MAX_ASPECT = 1.25;

const COMMONS_UPLOAD_PREFIX = 'https://upload.wikimedia.org/';

export type CoinSide = 'reverse' | 'obverse' | 'both' | 'unknown';
export type DenominationUnit = 'hryvnia' | 'kopiyka';

export interface ParsedDenomination {
  value: number;
  unit: DenominationUnit;
}

export interface LoadedFixture {
  file: string;
  data: RawFixtureFile;
}

export interface CoinQuery {
  file: string;
  index: number;
  country: string;
  denomination: string;
  year: number;
  variety: string | null;
  titleUk: string | null;
  commemorative: boolean;
  hasImage: boolean;
  siblingSubjects: string[];
  sameKindSiblings: number;
}

export type TextMatch = { kind: 'candidates'; titles: string[] } | { kind: 'ambiguous'; titles: string[] };

export type NoneReason = 'no-match' | 'licence-gate' | 'not-single-side';

export type MatchOutcome =
  | { kind: 'matched'; title: string; image: RawCoinImage }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'none'; reason: NoneReason; candidates: string[] };

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortedTitles(titles: Iterable<string>): string[] {
  return [...titles].sort(compareStrings);
}

// M1
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’ʼ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}

// M3
const HRYVNIA_PREFIXES = ['hryvn', 'hrivn', 'гривн', 'гривен'];
const KOPIYKA_PREFIXES = ['kopiy', 'kopii', 'kopik', 'kopek', 'kopec', 'копі'];

function unitOf(token: string): DenominationUnit | null {
  if (token === 'грн' || HRYVNIA_PREFIXES.some((p) => token.startsWith(p))) return 'hryvnia';
  if (token === 'коп' || KOPIYKA_PREFIXES.some((p) => token.startsWith(p))) return 'kopiyka';
  return null;
}

function parseDenominations(text: string): ParsedDenomination[] {
  const tokens = tokenize(text);
  const found: ParsedDenomination[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^\d+$/.test(token)) {
      const unit = i + 1 < tokens.length ? unitOf(tokens[i + 1]) : null;
      if (unit) found.push({ value: Number(token), unit });
      continue;
    }
    const glued = /^(\d+)(\D+)$/.exec(token);
    if (glued) {
      const unit = unitOf(glued[2]);
      if (unit) found.push({ value: Number(glued[1]), unit });
    }
  }
  return found;
}

export function parseDenomination(text: string): ParsedDenomination | null {
  return parseDenominations(text)[0] ?? null;
}

function sameDenomination(a: ParsedDenomination, b: ParsedDenomination): boolean {
  return a.value === b.value && a.unit === b.unit;
}

// M5
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'of', 'in', 'on', 'to']);

export function subjectTokens(subject: string): string[] {
  return tokenize(subject).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// M6
const COMMEMORATIVE_PREFIXES = ['commemorat', 'anniversar', 'памятн', 'ювілейн', 'річчя', 'роковин'];

export function hasCommemorativeMarker(text: string): boolean {
  return tokenize(text).some((t) => COMMEMORATIVE_PREFIXES.some((p) => t.startsWith(p)));
}

// M8
const REVERSE_WORDS = new Set(['reverse', 'rev', 'revers', 'реверс']);
const OBVERSE_WORDS = new Set(['obverse', 'obv', 'avers', 'аверс']);

export function detectSide(text: string): CoinSide {
  const tokens = tokenize(text);
  const reverse = tokens.some((t) => REVERSE_WORDS.has(t));
  const obverse = tokens.some((t) => OBVERSE_WORDS.has(t));
  if (reverse && obverse) return 'both';
  if (reverse) return 'reverse';
  if (obverse) return 'obverse';
  return 'unknown';
}

function titleText(title: string): string {
  return title.replace(/^File:/i, '').replace(/\.[^.\s]+$/, '');
}

// M2
export function fileText(file: CommonsFile): string {
  return [titleText(file.title), ...file.categories.map((c) => c.replace(/^Category:/i, ''))].join(' ');
}

type CoinWithTitle = RawCoinEntry & { titleUk?: string | null };

function denominationKey(denomination: string): string {
  const parsed = parseDenomination(denomination);
  return parsed ? `${parsed.value} ${parsed.unit}` : normalizeText(denomination);
}

// Siblings are computed across every loaded fixture, so a circulation coin and a
// commemorative of the same face value and year see each other.
export function buildCoinQueries(fixtures: readonly LoadedFixture[]): CoinQuery[] {
  const queries: CoinQuery[] = [];
  for (const { file, data } of fixtures) {
    const commemorative = /commemorative/i.test(data.name ?? '');
    (data.coins ?? []).forEach((raw, index) => {
      const coin = raw as CoinWithTitle;
      queries.push({
        file,
        index,
        country: data.country,
        denomination: data.denomination,
        year: coin.year,
        variety: coin.variety ?? null,
        titleUk: typeof coin.titleUk === 'string' && coin.titleUk.trim() !== '' ? coin.titleUk : null,
        commemorative,
        hasImage: coin.image !== null && typeof coin.image === 'object',
        siblingSubjects: [],
        sameKindSiblings: 0,
      });
    });
  }

  for (const q of queries) {
    const key = denominationKey(q.denomination);
    const subjects = new Set<string>();
    let sameKind = 0;
    for (const other of queries) {
      if (other === q) continue;
      if (other.country !== q.country || other.year !== q.year || denominationKey(other.denomination) !== key) continue;
      if (other.variety === q.variety) continue;
      if (other.commemorative === q.commemorative) sameKind += 1;
      if (other.variety !== null) {
        subjects.add(other.variety);
        if (other.titleUk !== null) subjects.add(other.titleUk);
      }
    }
    q.siblingSubjects = [...subjects];
    q.sameKindSiblings = sameKind;
  }
  return queries;
}

// A subject with no meaningful token never matches (it would match every file).
function fullyMatches(subject: string | null, tokens: ReadonlySet<string>): boolean {
  if (subject === null) return false;
  const wanted = subjectTokens(subject);
  return wanted.length > 0 && wanted.every((t) => tokens.has(t));
}

export function findTextCandidates(query: CoinQuery, files: readonly CommonsFile[]): TextMatch {
  const coinDenomination = parseDenomination(query.denomination);
  if (!coinDenomination) return { kind: 'candidates', titles: [] };
  const year = String(query.year);

  const base: Array<{ title: string; tokens: Set<string> }> = [];
  for (const file of files) {
    const text = fileText(file);
    const tokens = new Set(tokenize(text));
    if (!tokens.has(year)) continue;
    if (!parseDenominations(text).some((d) => sameDenomination(d, coinDenomination))) continue;
    if (!query.commemorative && hasCommemorativeMarker(text)) continue;
    base.push({ title: file.title, tokens });
  }

  const ownMatch = (tokens: Set<string>) => fullyMatches(query.variety, tokens) || fullyMatches(query.titleUk, tokens);

  const remaining = base.filter(
    ({ tokens }) => ownMatch(tokens) || !query.siblingSubjects.some((s) => fullyMatches(s, tokens)),
  );
  const strong = remaining.filter(({ tokens }) => ownMatch(tokens));

  if (strong.length > 0) return { kind: 'candidates', titles: sortedTitles(strong.map((f) => f.title)) };
  if (query.commemorative) return { kind: 'candidates', titles: [] };
  const titles = sortedTitles(remaining.map((f) => f.title));
  if (query.sameKindSiblings > 0) {
    return titles.length > 0 ? { kind: 'ambiguous', titles } : { kind: 'candidates', titles: [] };
  }
  return { kind: 'candidates', titles };
}

type Check = 'ok' | 'missing' | 'host' | 'gate' | 'shape' | 'several';

function checkFile(info: CommonsImageInfo | undefined): Check {
  if (!info) return 'missing';
  const image = toRawCoinImage(info);
  const hostOk = image.url.startsWith(COMMONS_UPLOAD_PREFIX) && info.url.startsWith(COMMONS_UPLOAD_PREFIX);
  const aspect = info.height > 0 ? info.width / info.height : Number.NaN;
  const shapeOk = aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
  const gateOk = toImageFields(image).imageUrl !== null;
  if (!hostOk) return 'host';
  if (shapeOk && gateOk) return 'ok';
  if (shapeOk) return 'gate';
  if (gateOk) return 'shape';
  return 'several';
}

export function chooseImage(titles: readonly string[], infos: ReadonlyMap<string, CommonsImageInfo>): MatchOutcome {
  const eligible: CommonsImageInfo[] = [];
  const failures = new Set<Check>();
  for (const title of titles) {
    const info = infos.get(title);
    const check = checkFile(info);
    if (check === 'ok' && info) eligible.push(info);
    else failures.add(check);
  }

  if (eligible.length === 0) {
    const reason: NoneReason = failures.has('gate')
      ? 'licence-gate'
      : failures.has('shape')
        ? 'not-single-side'
        : 'no-match';
    return { kind: 'none', reason, candidates: [...titles] };
  }

  const reverses = eligible.filter((info) => detectSide(titleText(info.title)) === 'reverse');
  const pool = reverses.length > 0 ? reverses : eligible;
  if (pool.length === 1) {
    return { kind: 'matched', title: pool[0].title, image: toRawCoinImage(pool[0]) };
  }
  return { kind: 'ambiguous', candidates: sortedTitles(pool.map((info) => info.title)) };
}
