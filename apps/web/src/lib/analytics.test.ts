/**
 * Tests for: lib/analytics (privacy-friendly PostHog analytics, growth backlog 0.6)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Module: analytics
 * Covers criteria: #4, #5, #6, #7, #9 (first touch), #13 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The module keeps state (client, initStarted, firstTouch), so every test loads a fresh copy with
 * vi.resetModules() and imports posthog-js after the reset, which gives the same mocked instance the
 * module's dynamic import resolves to.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture: vi.fn() },
}));

async function load() {
  vi.resetModules();
  const posthog = (await import('posthog-js')).default;
  const mod = await import('@/lib/analytics');
  return { mod, posthog };
}

function eventWith(properties: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { uuid: 'u-1', event: '$pageview', properties, ...extra } as never;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('analyticsRegion', () => {
  it.each([undefined, '', 'US', 'us', 'xx', 'usa'])('falls back to us for %j', async (raw) => {
    const { mod } = await load();

    expect(mod.analyticsRegion(raw)).toBe('us');
  });

  it.each(['eu', ' EU ', 'Eu'])('returns eu for %j', async (raw) => {
    const { mod } = await load();

    expect(mod.analyticsRegion(raw)).toBe('eu');
  });
});

describe('buildAnalyticsConfig', () => {
  it('pins the privacy options for eu', async () => {
    const { mod } = await load();

    const config = mod.buildAnalyticsConfig('eu');

    expect(config).toEqual(
      expect.objectContaining({
        api_host: '/relay',
        ui_host: 'https://eu.posthog.com',
        defaults: '2026-08-30',
        cookieless_mode: 'always',
        person_profiles: 'never',
        autocapture: false,
        disable_session_recording: true,
        before_send: mod.beforeSend,
      }),
    );
  });

  it('switches only the ui host for us', async () => {
    const { mod } = await load();

    const eu = mod.buildAnalyticsConfig('eu');
    const us = mod.buildAnalyticsConfig('us');

    expect(us.ui_host).toBe('https://us.posthog.com');
    expect(eu.ui_host).not.toBe(us.ui_host);
    expect(us.api_host).toBe('/relay');
    expect(us.cookieless_mode).toBe('always');
  });

  it('exports the defaults date and the allowed query keys', async () => {
    const { mod } = await load();

    expect(mod.POSTHOG_DEFAULTS).toBe('2026-08-30');
    expect([...mod.ALLOWED_QUERY_KEYS]).toEqual(['utm_source', 'utm_medium', 'utm_campaign', 'ref']);
  });
});

describe('stripUrlQuery', () => {
  it('drops the token from an absolute URL', async () => {
    const { mod } = await load();

    expect(mod.stripUrlQuery('https://example.com/reset-password?token=abc')).toBe(
      'https://example.com/reset-password',
    );
  });

  it('keeps allow-listed keys on a path and drops other keys and the fragment', async () => {
    const { mod } = await load();

    expect(mod.stripUrlQuery('/catalog?q=lincoln&utm_source=reddit&ref=fb#x')).toBe(
      '/catalog?utm_source=reddit&ref=fb',
    );
  });

  it('keeps all four allowed keys in their original order', async () => {
    const { mod } = await load();

    expect(
      mod.stripUrlQuery('https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&ref=d&token=t'),
    ).toBe('https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&ref=d');
  });

  it('returns no question mark when nothing allowed is left, and drops search text', async () => {
    const { mod } = await load();

    const stripped = mod.stripUrlQuery('https://example.com/catalog?q=1909+VDB&page=2#top');

    expect(stripped).toBe('https://example.com/catalog');
    expect(stripped).not.toContain('?');
    expect(stripped).not.toContain('VDB');
  });

  it('leaves a clean path and other strings unchanged', async () => {
    const { mod } = await load();

    expect(mod.stripUrlQuery('/glossary')).toBe('/glossary');
    expect(mod.stripUrlQuery('$direct')).toBe('$direct');
    expect(mod.stripUrlQuery('bulk')).toBe('bulk');
  });
});

describe('beforeSend', () => {
  it('passes null through', async () => {
    const { mod } = await load();

    expect(mod.beforeSend(null)).toBeNull();
  });

  it('strips the query from every URL-like property and keeps the rest untouched', async () => {
    const { mod } = await load();
    const input = eventWith(
      {
        $current_url: 'https://example.com/reset-password?token=abc',
        $referrer: 'https://news.example.org/post?q=secret&utm_source=hn',
        $pathname: '/catalog?q=lincoln',
        $initial_current_url: 'https://example.com/?utm_campaign=launch&email=a%40b.c',
        $host: 'example.com',
        coin_count: 3,
        via: 'bulk',
      },
      { $set_once: { $initial_referrer: 'https://news.example.org/?q=x&ref=r' } },
    );

    const result = mod.beforeSend(input);

    expect(result).not.toBeNull();
    expect(result?.properties).toEqual({
      $current_url: 'https://example.com/reset-password',
      $referrer: 'https://news.example.org/post?utm_source=hn',
      $pathname: '/catalog',
      $initial_current_url: 'https://example.com/?utm_campaign=launch',
      $host: 'example.com',
      coin_count: 3,
      via: 'bulk',
    });
    expect(result?.$set_once).toEqual({ $initial_referrer: 'https://news.example.org/?ref=r' });
    expect(result?.event).toBe('$pageview');
  });

  it('strips URL values in $set too, and does not touch events without them', async () => {
    const { mod } = await load();

    const withSet = mod.beforeSend(
      eventWith({ $current_url: '/a?x=1' }, { $set: { $current_url: 'https://example.com/b?token=t' } }),
    );
    const plain = mod.beforeSend(eventWith({ format: 'csv', scope: 'all' }));

    expect(withSet?.$set).toEqual({ $current_url: 'https://example.com/b' });
    expect(plain?.properties).toEqual({ format: 'csv', scope: 'all' });
  });

  it('does not mutate the event it was given', async () => {
    const { mod } = await load();
    const properties = { $current_url: 'https://example.com/x?token=abc' };

    mod.beforeSend(eventWith(properties));

    expect(properties.$current_url).toBe('https://example.com/x?token=abc');
  });
});

describe('initAnalytics: off without a token', () => {
  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])('never inits or captures when the token is %s', async (_label, value) => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
    else vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', value);
    const { mod, posthog } = await load();

    await mod.initAnalytics();
    mod.track('set_created', { method: 'blank', coin_count: 0 });

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('stays off in development without a token', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', '');
    const { mod, posthog } = await load();

    await mod.initAnalytics();
    mod.track('user_signed_up', { channel: 'direct' });

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('track is a no-op before any init', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', 'phc_test');
    const { mod, posthog } = await load();

    mod.track('set_created', { method: 'blank', coin_count: 0 });

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe('initAnalytics: on with a token', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', 'phc_test');
  });

  it('inits once with the privacy options, and a second call does not init again', async () => {
    const { mod, posthog } = await load();

    await mod.initAnalytics();
    await mod.initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: '/relay',
        ui_host: 'https://us.posthog.com',
        defaults: '2026-08-30',
        cookieless_mode: 'always',
        person_profiles: 'never',
        autocapture: false,
        disable_session_recording: true,
        before_send: mod.beforeSend,
      }),
    );
  });

  it('uses the eu ui host when the region is eu, and us for an unknown region', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_REGION', 'eu');
    const eu = await load();
    await eu.mod.initAnalytics();
    expect(vi.mocked(eu.posthog.init).mock.calls[0][1]).toEqual(
      expect.objectContaining({ ui_host: 'https://eu.posthog.com' }),
    );

    vi.stubEnv('NEXT_PUBLIC_POSTHOG_REGION', 'mars');
    const other = await load();
    await other.mod.initAnalytics();
    // The posthog-js mock is a single cached instance across resetModules, so the second init is the last call.
    expect(vi.mocked(other.posthog.init)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ ui_host: 'https://us.posthog.com' }),
    );
  });

  it('track captures the event name and the exact properties after init', async () => {
    const { mod, posthog } = await load();
    await mod.initAnalytics();

    mod.track('set_created', { method: 'blank', coin_count: 0 });
    mod.track('coins_marked_owned', { via: 'bulk', count: 7 });

    expect(posthog.capture).toHaveBeenCalledTimes(2);
    expect(posthog.capture).toHaveBeenNthCalledWith(1, 'set_created', { method: 'blank', coin_count: 0 });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, 'coins_marked_owned', { via: 'bulk', count: 7 });
  });

  it('swallows an init failure: no throw, and track stays a no-op', async () => {
    const { mod, posthog } = await load();
    vi.mocked(posthog.init).mockImplementationOnce(() => {
      throw new Error('init blew up');
    });

    await expect(mod.initAnalytics()).resolves.toBeUndefined();
    expect(() => mod.track('user_signed_up', { channel: 'direct' })).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('swallows a capture failure', async () => {
    const { mod, posthog } = await load();
    await mod.initAnalytics();
    vi.mocked(posthog.capture).mockImplementationOnce(() => {
      throw new Error('capture blew up');
    });

    expect(() => mod.track('user_signed_up', { channel: 'direct' })).not.toThrow();
  });

  it('writes nothing to cookies, localStorage or sessionStorage', async () => {
    window.history.replaceState({}, '', '/?utm_source=twitter');
    const { mod } = await load();

    await mod.initAnalytics();
    mod.track('user_signed_up', { channel: mod.getFirstTouchChannel() });

    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('event typing', () => {
  it('rejects unlisted events and extra properties at compile time', async () => {
    const { mod } = await load();

    // @ts-expect-error unknown_event is not in AnalyticsEvents
    mod.track('unknown_event', {});
    // @ts-expect-error name is not a property of set_created
    mod.track('set_created', { method: 'blank', coin_count: 1, name: 'x' });

    expect(true).toBe(true);
  });
});

describe('first-touch channel', () => {
  it('defaults to direct when nothing was captured', async () => {
    const { mod } = await load();

    expect(mod.getFirstTouchChannel()).toBe('direct');
  });

  it('prefers utm_source over ref, lowercased and trimmed', async () => {
    const { mod } = await load();

    mod.captureFirstTouch('?utm_source=Reddit&ref=x');

    expect(mod.getFirstTouchChannel()).toBe('reddit');
  });

  it('falls back to ref when there is no utm_source', async () => {
    const { mod } = await load();

    mod.captureFirstTouch('?ref=newsletter');

    expect(mod.getFirstTouchChannel()).toBe('newsletter');
  });

  it('never overwrites the first value', async () => {
    const { mod } = await load();

    mod.captureFirstTouch('?utm_source=reddit');
    mod.captureFirstTouch('?utm_source=other');

    expect(mod.getFirstTouchChannel()).toBe('reddit');
  });

  it('ignores an empty value, so a later real one still counts', async () => {
    const { mod } = await load();

    mod.captureFirstTouch('?utm_source=%20%20');
    expect(mod.getFirstTouchChannel()).toBe('direct');
    mod.captureFirstTouch('?ref=friend');

    expect(mod.getFirstTouchChannel()).toBe('friend');
  });

  it('cuts the value to 64 characters', async () => {
    const { mod } = await load();

    mod.captureFirstTouch(`?utm_source=${'a'.repeat(100)}`);

    expect(mod.getFirstTouchChannel()).toBe('a'.repeat(64));
  });

  it('a fresh module starts over, so a new tab has its own channel', async () => {
    const first = await load();
    first.mod.captureFirstTouch('?utm_source=reddit');

    const second = await load();

    expect(second.mod.getFirstTouchChannel()).toBe('direct');
  });

  it('initAnalytics reads the URL of the tab even without a token', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
    window.history.replaceState({}, '', '/?utm_source=twitter');
    const { mod, posthog } = await load();

    await mod.initAnalytics();

    expect(mod.getFirstTouchChannel()).toBe('twitter');
    expect(posthog.init).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
