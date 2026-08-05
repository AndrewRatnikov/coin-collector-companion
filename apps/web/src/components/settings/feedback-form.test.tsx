/**
 * Tests for: FeedbackForm
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Component: FeedbackForm (CREATE)
 * Covers criteria: #2, #3, #4, #5, #6, #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useSubmitFeedback is mocked entirely — no real network call, same mutationMock
 * convention as apps/web/src/components/catalog/submit-coin-form.test.tsx. The textarea
 * is queried via document.getElementById('feedback-text') (not a data-testid), matching
 * this repo's established FormField/ChangePasswordForm convention for form inputs. The
 * 2001-character over-limit case is set via fireEvent.change rather than userEvent.type
 * to avoid typing 2001 characters one at a time (userEvent.type is intentionally slow —
 * fireEvent.change is the established convention here for wholesale-replacing a
 * controlled input's value, per memory.md's recorded gotcha).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackForm } from '@/components/settings/feedback-form';
import { useSubmitFeedback } from '@/lib/hooks/use-feedback';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/hooks/use-feedback', () => ({
  useSubmitFeedback: vi.fn(),
}));

const useSubmitFeedbackMock = vi.mocked(useSubmitFeedback);

function mutationMock({ resolvedValue, rejectedValue }: { resolvedValue?: unknown; rejectedValue?: unknown } = {}) {
  const mutate = vi.fn(
    (_vars: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) opts?.onError?.(rejectedValue);
      else opts?.onSuccess?.(resolvedValue);
    },
  );
  return { mutate, isPending: false };
}

async function typeAndSubmit(text: string) {
  const user = userEvent.setup();
  const textarea = document.getElementById('feedback-text') as HTMLTextAreaElement;
  await user.type(textarea, text);
  await user.click(screen.getByTestId('settings-feedback-submit'));
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    useSubmitFeedbackMock.mockReset();
    useSubmitFeedbackMock.mockReturnValue(mutationMock() as never);
  });

  describe('rendering', () => {
    it('renders the form root, textarea, and submit button', () => {
      render(<FeedbackForm />);
      expect(screen.getByTestId('settings-feedback-form')).toBeInTheDocument();
      expect(document.getElementById('feedback-text')).toBeInTheDocument();
      expect(screen.getByTestId('settings-feedback-submit')).toBeInTheDocument();
    });
  });

  describe('criterion #6: empty/whitespace-only submission is blocked client-side', () => {
    it('shows a validation error and does not call mutate when submitting with no text', async () => {
      render(<FeedbackForm />);
      const user = userEvent.setup();
      await user.click(screen.getByTestId('settings-feedback-submit'));

      await waitFor(() => {
        expect(document.getElementById('feedback-text-error')).toHaveTextContent(
          'Please enter some feedback before submitting.',
        );
      });
      const mutation = useSubmitFeedbackMock.mock.results[0]?.value as { mutate: ReturnType<typeof vi.fn> };
      expect(mutation.mutate).not.toHaveBeenCalled();
    });

    it('shows a validation error and does not call mutate when submitting whitespace-only text', async () => {
      render(<FeedbackForm />);
      await typeAndSubmit('     ');

      await waitFor(() => {
        expect(document.getElementById('feedback-text-error')).toHaveTextContent(
          'Please enter some feedback before submitting.',
        );
      });
      const mutation = useSubmitFeedbackMock.mock.results[0]?.value as { mutate: ReturnType<typeof vi.fn> };
      expect(mutation.mutate).not.toHaveBeenCalled();
    });
  });

  describe('criterion #8: over-length text is blocked client-side', () => {
    it('shows a validation error and does not call mutate when text exceeds 2000 characters', async () => {
      render(<FeedbackForm />);
      const textarea = document.getElementById('feedback-text') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'a'.repeat(2001) } });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('settings-feedback-submit'));

      await waitFor(() => {
        expect(document.getElementById('feedback-text-error')).toHaveTextContent(
          'Feedback must be 2000 characters or fewer.',
        );
      });
      const mutation = useSubmitFeedbackMock.mock.results[0]?.value as { mutate: ReturnType<typeof vi.fn> };
      expect(mutation.mutate).not.toHaveBeenCalled();
    });
  });

  describe('criteria #2, #3: valid submission calls mutate with the trimmed text', () => {
    it('calls mutate with { text } trimmed of surrounding whitespace', async () => {
      const mutation = mutationMock();
      useSubmitFeedbackMock.mockReturnValue(mutation as never);
      render(<FeedbackForm />);

      const textarea = document.getElementById('feedback-text') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '  Great app!  ' } });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('settings-feedback-submit'));

      expect(mutation.mutate).toHaveBeenCalledWith(
        { text: 'Great app!' },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
    });
  });

  describe('criterion #4: success shows confirmation and clears the input', () => {
    it('renders settings-feedback-success and clears the textarea on success', async () => {
      useSubmitFeedbackMock.mockReturnValue(mutationMock({ resolvedValue: { id: 'f1' } }) as never);
      render(<FeedbackForm />);

      await typeAndSubmit('Great app!');

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback-success')).toHaveTextContent('Thanks for your feedback!');
      });
      expect((document.getElementById('feedback-text') as HTMLTextAreaElement).value).toBe('');
    });
  });

  describe('criterion #5: failure shows an error and preserves the typed text', () => {
    it('renders settings-feedback-error with the ApiError details and does not clear the textarea', async () => {
      useSubmitFeedbackMock.mockReturnValue(
        mutationMock({ rejectedValue: new ApiError(400, 'text must be shorter than or equal to 2000 characters') }) as never,
      );
      render(<FeedbackForm />);

      await typeAndSubmit('Great app!');

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback-error')).toHaveTextContent(
          'text must be shorter than or equal to 2000 characters',
        );
      });
      expect((document.getElementById('feedback-text') as HTMLTextAreaElement).value).toBe('Great app!');
      expect(screen.queryByTestId('settings-feedback-success')).not.toBeInTheDocument();
    });

    it('renders a generic fallback error for a non-ApiError failure', async () => {
      useSubmitFeedbackMock.mockReturnValue(mutationMock({ rejectedValue: new Error('network down') }) as never);
      render(<FeedbackForm />);

      await typeAndSubmit('Great app!');

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback-error')).toHaveTextContent(
          'Something went wrong sending your feedback. Please try again.',
        );
      });
    });
  });
});
