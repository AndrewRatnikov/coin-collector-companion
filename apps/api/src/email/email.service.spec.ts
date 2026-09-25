/**
 * Tests for: EmailService (backlog_password-management.md Step 3, task 3.2).
 * `fetch` is replaced with a jest mock — no real request ever reaches Resend.
 */

import { ConfigService } from '@nestjs/config';
import { DEFAULT_EMAIL_FROM, EmailService, RESEND_ENDPOINT } from './email.service';

function serviceWith(values: Record<string, string | undefined>) {
  return new EmailService({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('EmailService.sendPasswordResetEmail', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not call Resend when RESEND_API_KEY is missing', async () => {
    await serviceWith({}).sendPasswordResetEmail('a@example.com', 'https://x/reset-password?token=t');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the email to Resend with the API key and the reset link', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await serviceWith({ RESEND_API_KEY: 're_test' }).sendPasswordResetEmail(
      'a@example.com',
      'https://x/reset-password?token=t',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.from).toBe(DEFAULT_EMAIL_FROM);
    expect(body.to).toEqual(['a@example.com']);
    expect(body.text).toContain('https://x/reset-password?token=t');
  });

  it('uses EMAIL_FROM when it is set', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await serviceWith({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'Coins <no-reply@coins.example.com>' }).sendPasswordResetEmail(
      'a@example.com',
      'https://x',
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('Coins <no-reply@coins.example.com>');
  });

  it('throws when Resend rejects the request', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('domain not verified') });

    await expect(
      serviceWith({ RESEND_API_KEY: 're_test' }).sendPasswordResetEmail('a@example.com', 'https://x'),
    ).rejects.toThrow('403');
  });
});
