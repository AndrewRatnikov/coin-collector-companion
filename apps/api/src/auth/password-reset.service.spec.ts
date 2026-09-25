/**
 * Tests for: PasswordResetService (backlog_password-management.md Step 3, task 3.5)
 *
 * PrismaService, TokenService, EmailService and ConfigService are all mocked — no real DB,
 * network or email, same `useValue` mock convention as auth.service.spec.ts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { FORGOT_PASSWORD_MESSAGE, PASSWORD_RESET_TOKEN_TTL_MS, PasswordResetService } from './password-reset.service';
import { TokenService, hashToken } from './token.service';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const USER = { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'collector@example.com' };
const RAW_TOKEN = 'a'.repeat(64);

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    passwordResetToken: { findUnique: jest.Mock; create: jest.Mock; updateMany: jest.Mock; deleteMany: jest.Mock };
  };
  let tokenService: { revokeAllForUser: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    tokenService = { revokeAllForUser: jest.fn() };
    emailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    configValues = { FRONTEND_URL: 'https://coins.example.com/' };
    mockedBcrypt.hash.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
      ],
    }).compile();

    service = module.get(PasswordResetService);
  });

  describe('forgotPassword', () => {
    it('returns the same generic message for an unknown email and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nobody@example.com' });

      expect(result).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('returns the identical response for a known email, and emails a link whose token is stored only as a hash', async () => {
      prisma.user.findUnique.mockResolvedValue(USER);
      const before = Date.now();

      const result = await service.forgotPassword({ email: USER.email });

      expect(result).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [to, resetUrl] = emailService.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe(USER.email);
      const url = new URL(resetUrl);
      expect(`${url.origin}${url.pathname}`).toBe('https://coins.example.com/reset-password');
      const rawToken = url.searchParams.get('token')!;
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

      const { data } = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(data.userId).toBe(USER.id);
      expect(data.tokenHash).toBe(hashToken(rawToken));
      expect(data.tokenHash).not.toBe(rawToken);
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + PASSWORD_RESET_TOKEN_TTL_MS);
      expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    });

    it('removes earlier unused reset tokens before issuing a new one', async () => {
      prisma.user.findUnique.mockResolvedValue(USER);

      await service.forgotPassword({ email: USER.email });

      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id, usedAt: null } });
      expect(prisma.passwordResetToken.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.passwordResetToken.create.mock.invocationCallOrder[0],
      );
    });

    it('still returns the generic message when the email send fails', async () => {
      prisma.user.findUnique.mockResolvedValue(USER);
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('Resend is down'));

      await expect(service.forgotPassword({ email: USER.email })).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    });

    it('falls back to CORS_ORIGIN for the link when FRONTEND_URL is not set', async () => {
      configValues = { CORS_ORIGIN: 'https://web.example.vercel.app' };
      prisma.user.findUnique.mockResolvedValue(USER);

      await service.forgotPassword({ email: USER.email });

      const [, resetUrl] = emailService.sendPasswordResetEmail.mock.calls[0];
      expect(resetUrl.startsWith('https://web.example.vercel.app/reset-password?token=')).toBe(true);
    });
  });

  describe('resetPassword', () => {
    const dto = { token: RAW_TOKEN, newPassword: 'new-password-123' };
    const validToken = () => ({
      id: 'token-id',
      userId: USER.id,
      tokenHash: hashToken(RAW_TOKEN),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
    });

    function expectNothingChanged() {
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(tokenService.revokeAllForUser).not.toHaveBeenCalled();
    }

    it('rejects a token that does not exist', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken(RAW_TOKEN) } });
      expectNothingChanged();
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({ ...validToken(), expiresAt: new Date(Date.now() - 1000) });

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(BadRequestException);
      expectNothingChanged();
    });

    it('rejects an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({ ...validToken(), usedAt: new Date() });

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(BadRequestException);
      expectNothingChanged();
    });

    it('rejects when a concurrent request claimed the token first', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validToken());
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(BadRequestException);
      expectNothingChanged();
    });

    it('accepts a valid token: marks it used, sets the new password hash, and revokes every session', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validToken());
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockedBcrypt.hash.mockResolvedValue('new-hash' as never);

      await service.resetPassword(dto);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-id', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('new-password-123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: USER.id }, data: { passwordHash: 'new-hash' } });
      expect(tokenService.revokeAllForUser).toHaveBeenCalledWith(USER.id);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id, usedAt: null } });
    });
  });
});
