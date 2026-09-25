import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_COST } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService, hashToken } from './token.service';

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour (backlog task 3.3)

export const FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

export interface ForgotPasswordResponse {
  message: string;
}

// backlog_password-management.md Step 3. Kept apart from AuthService so the reset flow's
// extra dependencies (email, frontend URL config) don't leak into login/refresh.
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // POST /auth/forgot-password (task 3.3). Always resolves to the same message, whether or
  // not the email belongs to an account, so the endpoint can't be used to find out which
  // emails are registered. For the same reason a failed email send is logged, not thrown,
  // and the send isn't awaited, so the response time doesn't depend on it either.
  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, email: true } });

    if (user) {
      // Only the newest link should work: drop any earlier unused ones for this user.
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

      const rawToken = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${this.frontendUrl()}/reset-password?token=${rawToken}`;
      this.emailService.sendPasswordResetEmail(user.email, resetUrl).catch((err: unknown) => {
        this.logger.error(`Failed to send password reset email: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  // POST /auth/reset-password (task 3.4). The token is claimed with a conditional
  // updateMany (usedAt: null) before the password changes, so two requests racing with the
  // same link can't both succeed.
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(dto.token) } });
    const now = new Date();

    if (!token || token.usedAt || token.expiresAt < now) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash } });
    // Log out every existing session (decision 6), and invalidate any other outstanding links.
    await this.tokenService.revokeAllForUser(token.userId);
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: token.userId, usedAt: null } });
  }

  // FRONTEND_URL is where reset links point. Falls back to CORS_ORIGIN (already set to the
  // Vercel origin in production) and then to the local web dev server.
  private frontendUrl(): string {
    const url =
      this.config.get<string>('FRONTEND_URL') || this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
    return url.replace(/\/+$/, '');
  }
}
