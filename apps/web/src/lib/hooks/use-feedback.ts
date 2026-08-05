import { useMutation } from '@tanstack/react-query';
import type { FeedbackResponse } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { submitFeedback } from '@/lib/feedback-api';

export function useSubmitFeedback() {
  return useMutation<FeedbackResponse, ApiError, { text: string }>({
    mutationFn: ({ text }) => submitFeedback(text),
  });
}
