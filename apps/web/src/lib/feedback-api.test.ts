/**
 * Tests for: feedback-api
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Frontend API:
 *                   apps/web/src/lib/feedback-api.ts (CREATE)
 * Covers criteria: #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * fetch is mocked via vi.stubGlobal, not vi.mock(), same convention as
 * apps/web/src/lib/collection-api.test.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitFeedback } from '@/lib/feedback-api';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const FEEDBACK_RESPONSE = {
  id: 'feedback-1',
  userId: 'user-1',
  text: 'Great app!',
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
};

describe('feedback-api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion #3: submitFeedback calls POST /feedback with { text } and returns FeedbackResponse', () => {
    it('sends a POST to /feedback with the given text as the JSON body', async () => {
      const fetchMock = stubFetchResolving(201, FEEDBACK_RESPONSE);
      await submitFeedback('Great app!');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/feedback')).toBe(true);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ text: 'Great app!' });
    });

    it('returns the raw FeedbackResponse body', async () => {
      stubFetchResolving(201, FEEDBACK_RESPONSE);
      await expect(submitFeedback('Great app!')).resolves.toEqual(FEEDBACK_RESPONSE);
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(400, { message: 'text must be shorter than or equal to 2000 characters' });
      await expect(submitFeedback('x'.repeat(2001))).rejects.toThrow();
    });
  });
});
