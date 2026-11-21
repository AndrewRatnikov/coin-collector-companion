// Privacy-friendly product analytics (PostHog Cloud, cookieless). This is the only module that
// talks to the PostHog SDK; everything else calls `track()`. Users are never identified, nothing is
// written to browser storage, and every event URL keeps only the allow-listed query keys.
import type { CaptureResult, PostHog, PostHogConfig } from 'posthog-js';

export type AnalyticsRegion = 'eu' | 'us';

/** The closed list of custom events and their only allowed properties. */
export interface AnalyticsEvents {
  user_signed_up: { channel: string };
  set_created: { method: 'blank' | 'filter' | 'manual'; coin_count: number };
  set_cloned: { source: 'canonical' | 'public'; coin_count: number };
  coins_marked_owned: { via: 'toggle' | 'bulk' | 'import'; count: number };
  want_list_exported: { format: 'print' | 'csv'; scope: 'set' | 'all' | 'sample' };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** PostHog's `defaults` date: automatic page views and page leaves on client-side navigation. */
export const POSTHOG_DEFAULTS = '2026-08-30';

/** The only query keys an event URL may keep. */
export const ALLOWED_QUERY_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'] as const;

const FIRST_TOUCH_MAX_LENGTH = 64;

// Module memory only: a new tab (or a reload) starts over.
let client: PostHog | null = null;
let initStarted = false;
let firstTouch: string | null = null;

export function analyticsRegion(raw: string | undefined): AnalyticsRegion {
  return raw?.trim().toLowerCase() === 'us' ? 'us' : 'eu';
}

function isUrlLike(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

/** Drops every query key except ALLOWED_QUERY_KEYS, and the fragment, from a URL or path. */
export function stripUrlQuery(value: string): string {
  if (!isUrlLike(value)) return value;
  try {
    const isAbsolute = !value.startsWith('/');
    const url = new URL(value, 'http://x');
    const kept = new URLSearchParams();
    url.searchParams.forEach((paramValue, key) => {
      if ((ALLOWED_QUERY_KEYS as readonly string[]).includes(key)) kept.append(key, paramValue);
    });
    const query = kept.toString();
    const base = isAbsolute ? url.origin + url.pathname : url.pathname;
    return query ? `${base}?${query}` : base;
  } catch {
    const cut = value.search(/[?#]/);
    return cut === -1 ? value : value.slice(0, cut);
  }
}

function stripUrlValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = typeof value === 'string' ? stripUrlQuery(value) : value;
  }
  return out;
}

/**
 * PostHog `before_send`: strips the query from every URL-like string the event carries.
 * Typed wider than BeforeSendFn (it also accepts null) and still assignable to it.
 */
export const beforeSend = (event: CaptureResult | null): CaptureResult | null => {
  if (event === null) return null;
  const result: CaptureResult = { ...event };
  if (event.properties) result.properties = stripUrlValues(event.properties);
  if (event.$set) result.$set = stripUrlValues(event.$set);
  if (event.$set_once) result.$set_once = stripUrlValues(event.$set_once);
  return result;
};

export function buildAnalyticsConfig(region: AnalyticsRegion): Partial<PostHogConfig> {
  return {
    api_host: '/relay',
    ui_host: `https://${region}.posthog.com`,
    defaults: POSTHOG_DEFAULTS,
    cookieless_mode: 'always',
    person_profiles: 'never',
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    // Sentry owns error reporting.
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    before_send: beforeSend,
  };
}

/** Remembers the first utm_source (else ref) seen in this tab; later values never overwrite it. */
export function captureFirstTouch(search: string): void {
  if (firstTouch !== null) return;
  const params = new URLSearchParams(search);
  for (const key of ['utm_source', 'ref']) {
    const value = (params.get(key) ?? '').trim().toLowerCase().slice(0, FIRST_TOUCH_MAX_LENGTH);
    if (value) {
      firstTouch = value;
      return;
    }
  }
}

export function getFirstTouchChannel(): string {
  return firstTouch ?? 'direct';
}

/** Starts analytics once, in the browser, only when NEXT_PUBLIC_POSTHOG_TOKEN is set. Never throws. */
export async function initAnalytics(): Promise<void> {
  if (typeof window === 'undefined' || initStarted) return;
  initStarted = true;
  try {
    captureFirstTouch(window.location.search);
    const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
    if (!token) return;
    // Loaded only when analytics is on, so visitors without it never download the SDK.
    const { default: posthog } = await import('posthog-js');
    posthog.init(token, buildAnalyticsConfig(analyticsRegion(process.env.NEXT_PUBLIC_POSTHOG_REGION)));
    client = posthog;
  } catch {
    // Analytics must never break the app.
    client = null;
  }
}

/** Sends one custom event; a no-op while analytics is off or not yet loaded. */
export function track<E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]): void {
  if (!client) return;
  try {
    client.capture(event, properties);
  } catch {
    // Analytics must never break the app.
  }
}
