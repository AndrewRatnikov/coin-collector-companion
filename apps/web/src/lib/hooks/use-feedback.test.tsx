/**
 * Tests for: use-feedback hook
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Frontend hook:
 *                   apps/web/src/lib/hooks/use-feedback.ts (CREATE)
 * Covers criteria: #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * submitFeedback is mocked entirely — no real network call. Follows the same
 * renderHook + QueryClientProvider convention as apps/web/src/lib/hooks/use-collection.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitFeedback } from '@/lib/hooks/use-feedback';
import { submitFeedback } from '@/lib/feedback-api';

vi.mock('@/lib/feedback-api', () => ({
  submitFeedback: vi.fn(),
}));

const submitFeedbackMock = vi.mocked(submitFeedback);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

const FEEDBACK_RESPONSE = {
  id: 'feedback-1',
  userId: 'user-1',
  text: 'Great app!',
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
};

describe('useSubmitFeedback (criterion #3)', () => {
  beforeEach(() => {
    submitFeedbackMock.mockReset();
  });

  it('calls submitFeedback with the given text', async () => {
    submitFeedbackMock.mockResolvedValue(FEEDBACK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSubmitFeedback(), { wrapper });
    result.current.mutate({ text: 'Great app!' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(submitFeedbackMock).toHaveBeenCalledWith('Great app!');
  });

  it('exposes the resolved FeedbackResponse as mutation data', async () => {
    submitFeedbackMock.mockResolvedValue(FEEDBACK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSubmitFeedback(), { wrapper });
    result.current.mutate({ text: 'Great app!' });

    await waitFor(() => {
      expect(result.current.data).toEqual(FEEDBACK_RESPONSE);
    });
  });

  it('surfaces a rejection as mutation error', async () => {
    submitFeedbackMock.mockRejectedValue(new Error('network error'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSubmitFeedback(), { wrapper });
    result.current.mutate({ text: 'Great app!' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
