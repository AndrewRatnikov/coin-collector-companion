/**
 * Tests for: AuthService.me, AuthService.changePassword
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Service: AuthService (MODIFY)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Service: AuthService (MODIFY)
 *                   runs/run_20260802_221803/plan.md § Interface Contract → Module: apps/api/src/auth/auth.service.ts (MODIFY)
 * Covers criteria: #2, #3 (from run_20260802_172836's prd.md), #2, #3, #4 (from run_20260802_183303's prd.md),
 *                  #4, #5, #6, #7, #8 (from run_20260802_221803's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (user.findUniqueOrThrow, user.update, user.findUnique) — no
 * real DB or network call, following catalog.service.spec.ts's established `useValue` mock
 * convention.
 *
 * run_20260802_183303: adds a file-level `jest.mock('bcrypt')` (not needed by the existing
 * `me` tests, which never call bcrypt, so this addition is safe/inert for them) to control
 * `bcrypt.compare`/`bcrypt.hash` deterministically without a real hash computation, plus
 * `changePassword` coverage (new describe block below). The `me` describe block above is
 * carried over byte-identical from run_20260802_172836.
 *
 * run_20260802_221803: adds `TokenService` as a third mocked provider (needed by `login`,
 * `refresh`, `logout`, and the retrofitted `changePassword`) and `user.findUnique` to the
 * Prisma mock (needed by `login`, which looks up by email rather than id) — neither is used
 * by the existing `me` tests, safe/inert for them. New describe blocks for `login`, `refresh`,
 * `logout`, and an extended `changePassword` revocation assertion are added below. Every
 * existing `me`/`changePassword` `it` block is carried over byte-identical.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: {
    user: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let mockJwtService: {
    signAsync: jest.Mock;
  };
  let mockTokenService: {
    issue: jest.Mock;
    rotate: jest.Mock;
    revokeAllForUser: jest.Mock;
    revokeOne: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    mockJwtService = {
      signAsync: jest.fn(),
    };
    mockTokenService = {
      issue: jest.fn(),
      rotate: jest.fn(),
      revokeAllForUser: jest.fn(),
      revokeOne: jest.fn(),
    };
    mockedBcrypt.compare.mockReset();
    mockedBcrypt.hash.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('me (criteria #2, #3 from run_20260802_172836)', () => {
    it('looks up the user by id and selects only id/email/createdAt (never passwordHash)', async () => {
      const userId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      await service.me(userId);

      expect(mockPrismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, email: true, createdAt: true },
      });
      const callArgs = mockPrismaService.user.findUniqueOrThrow.mock.calls[0][0];
      expect(callArgs.select).not.toHaveProperty('passwordHash');
    });

    it('returns the resolved user with no passwordHash key', async () => {
      const userId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      const expected = {
        id: userId,
        email: 'collector@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue(expected);

      const result = await service.me(userId);

      expect(result).toEqual(expected);
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword (criteria #2, #3, #4 from run_20260802_183303)', () => {
    const userId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const dto: ChangePasswordDto = { currentPassword: 'oldpassword123', newPassword: 'newpassword123' } as ChangePasswordDto;

    it('rejects with UnauthorizedException and performs no write when currentPassword is wrong', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.changePassword(userId, dto)).rejects.toThrow(UnauthorizedException);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(dto.currentPassword, 'stored-hash');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('hashes and persists the new password when currentPassword is correct', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);

      await service.changePassword(userId, dto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(dto.newPassword, 10);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('looks up the user by id before comparing the current password', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);

      await service.changePassword(userId, dto);

      expect(mockPrismaService.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: userId } });
    });
  });

  describe('changePassword — session revocation retrofit (criterion #7 from run_20260802_221803)', () => {
    const userId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const dto: ChangePasswordDto = { currentPassword: 'oldpassword123', newPassword: 'newpassword123' } as ChangePasswordDto;

    it('calls tokenService.revokeAllForUser after a successful password change', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);

      await service.changePassword(userId, dto);

      expect(mockTokenService.revokeAllForUser).toHaveBeenCalledWith(userId);
    });

    it('does NOT call tokenService.revokeAllForUser when currentPassword is wrong', async () => {
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({
        id: userId,
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.changePassword(userId, dto)).rejects.toThrow(UnauthorizedException);

      expect(mockTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('login (criteria #4, #8 from run_20260802_221803)', () => {
    const dto: LoginDto = { email: 'collector@example.com', password: 'correct-horse' } as LoginDto;

    it('returns accessToken + refreshToken on valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockJwtService.signAsync.mockResolvedValue('signed-access-token');
      mockTokenService.issue.mockResolvedValue({
        rawToken: 'raw-refresh-token',
        familyId: 'family-1',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      });

      const result = await service.login(dto);

      expect(result).toEqual({ accessToken: 'signed-access-token', refreshToken: 'raw-refresh-token' });
    });

    it('calls tokenService.issue with the authenticated user id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockJwtService.signAsync.mockResolvedValue('signed-access-token');
      mockTokenService.issue.mockResolvedValue({
        rawToken: 'raw-refresh-token',
        familyId: 'family-1',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      });

      await service.login(dto);

      expect(mockTokenService.issue).toHaveBeenCalledWith('user-1');
    });

    it('rejects with UnauthorizedException and never calls tokenService.issue on wrong credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'collector@example.com',
        passwordHash: 'stored-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(mockTokenService.issue).not.toHaveBeenCalled();
    });

    it('rejects with UnauthorizedException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(mockTokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh (criteria #5, #8 from run_20260802_221803)', () => {
    it('rejects with UnauthorizedException immediately when no cookie value is given, without calling tokenService.rotate', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);

      expect(mockTokenService.rotate).not.toHaveBeenCalled();
    });

    it('rotates the token and mints a new access token from the rotated userId/email', async () => {
      mockTokenService.rotate.mockResolvedValue({
        userId: 'user-1',
        email: 'collector@example.com',
        rawToken: 'new-raw-refresh-token',
        familyId: 'family-1',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      });
      mockJwtService.signAsync.mockResolvedValue('new-signed-access-token');

      const result = await service.refresh('old-raw-refresh-token');

      expect(mockTokenService.rotate).toHaveBeenCalledWith('old-raw-refresh-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: 'collector@example.com' });
      expect(result).toEqual({ accessToken: 'new-signed-access-token', refreshToken: 'new-raw-refresh-token' });
    });

    it('propagates a rejection from tokenService.rotate (e.g. invalid/expired/reused token)', async () => {
      mockTokenService.rotate.mockRejectedValue(new UnauthorizedException('Invalid or expired refresh token'));

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout (criterion #6 from run_20260802_221803)', () => {
    it('calls tokenService.revokeOne when a refresh token is given', async () => {
      mockTokenService.revokeOne.mockResolvedValue(undefined);

      await service.logout('raw-refresh-token');

      expect(mockTokenService.revokeOne).toHaveBeenCalledWith('raw-refresh-token');
    });

    it('is a no-op and does not throw when no refresh token is given', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();

      expect(mockTokenService.revokeOne).not.toHaveBeenCalled();
    });
  });
});
