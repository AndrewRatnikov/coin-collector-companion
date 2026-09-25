import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Resend's shared sender works with no domain setup, but can only deliver to the Resend
// account owner's own inbox (backlog_password-management.md decision 2). Override with
// EMAIL_FROM once a sending domain is verified.
export const DEFAULT_EMAIL_FROM = 'Coin Collector Companion <onboarding@resend.dev>';

// backlog_password-management.md Step 3, task 3.2. Calls Resend's REST API directly with
// the built-in fetch instead of the `resend` SDK: it's one POST, and skipping the SDK
// avoids a new runtime dependency for a single transactional email.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is not set, so the password reset email was not sent');
      // Opt-in only, for local dev without a Resend key. Never enable this in production:
      // anyone who can read the logs could use the link.
      if (this.config.get<string>('EMAIL_LOG_RESET_LINKS') === 'true') {
        this.logger.log(`Password reset link for ${to}: ${resetUrl}`);
      }
      return;
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('EMAIL_FROM') || DEFAULT_EMAIL_FROM,
        to: [to],
        subject: 'Reset your Coin Collector Companion password',
        text: [
          'Someone asked to reset the password for your Coin Collector Companion account.',
          '',
          `Reset it here (the link expires in 1 hour and works once): ${resetUrl}`,
          '',
          "If you didn't ask for this, you can ignore this email. Your password won't change.",
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Resend rejected the password reset email (${response.status}): ${body}`);
    }
  }
}
