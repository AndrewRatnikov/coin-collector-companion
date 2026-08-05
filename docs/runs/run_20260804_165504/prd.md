# PRD: Feedback form in Settings

**Run:** run_20260804_165504
**Date:** 2026-08-04

## Goal

Logged-in users currently have no in-app way to send feedback to the team — the only page under Settings today is a single view combining account info and a change-password form. This task adds a second tab to Settings, "Feedback," containing a form where a logged-in user can submit free-text feedback that gets persisted server-side, tied to their account, so the team can review it later. It solves the product team's lack of a lightweight, low-friction feedback channel from active users.

## User stories

- As a logged-in user, I want to open a "Feedback" tab in Settings so that I can find a place to tell the team what I think.
- As a logged-in user, I want to type free-text feedback and submit it so that it reaches the team without leaving the app.
- As a logged-in user, I want confirmation that my feedback was received so that I know the submission succeeded.
- As a logged-in user, I want to see a clear error if submission fails so that I know to retry.
- As an anonymous (logged-out) visitor, I should not be able to submit feedback, since Settings itself already requires authentication.

## Acceptance criteria

1. The Settings page (`/settings`) has two tabs: an existing "Account" tab (current account info + change-password content) and a new "Feedback" tab. Switching tabs does not navigate away from `/settings` (no full page reload) and does not lose the non-active tab's state semantics expected by users (each tab's form resets are independent).
2. The Feedback tab contains a form with a multi-line text input for the feedback message and a submit button.
3. Submitting non-empty feedback text sends it to a backend endpoint that persists a new row containing: the authenticated user's identifying reference (their user id, per the users table — email may be resolved from that relation, not stored redundantly if the schema already relates feedback to a user) and the feedback text.
4. On successful submission, the form shows a success confirmation message and clears the text input.
5. On a submission failure (network/server error), the form shows an error message and preserves the user's typed text (not cleared).
6. Submitting empty/whitespace-only feedback text is blocked client-side with a validation message, and no request is sent.
7. The Feedback tab and its submit action are only reachable by authenticated users — the entire Settings page already requires login (via the existing `RequireAuth` wrapper); the backend endpoint that persists feedback independently rejects unauthenticated requests (401), not relying on the frontend guard alone.
8. Feedback text has a reasonable maximum length enforced both client-side (form validation) and server-side (DTO validation), so oversized payloads are rejected with a clear error rather than silently truncated or causing a server error.

## Out of scope

- Any admin-facing UI to view, list, or manage submitted feedback (this task only covers user-facing submission).
- Editing or deleting previously submitted feedback.
- Email notifications or Slack alerts triggered by new feedback.
- Rating/scoring, categories, tags, or attachments on feedback (text-only, per the task).
- Rate-limiting or spam protection beyond standard auth (no CAPTCHA, no throttling) — can be added later if abuse is observed.
- Any changes to the existing change-password tab's behavior beyond relocating it under an "Account" tab label.

## Open questions

None — the task, existing Settings page structure, and existing auth patterns (RequireAuth, JWT-guarded API routes) provide enough to proceed.
