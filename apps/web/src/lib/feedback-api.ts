import type { FeedbackResponse, SubmitFeedbackRequest } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export async function submitFeedback(text: string): Promise<FeedbackResponse> {
  const body: SubmitFeedbackRequest = { text };
  return apiFetch<FeedbackResponse>('/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
