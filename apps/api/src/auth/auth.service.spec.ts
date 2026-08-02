/**
 * Tests for: AuthService.me, AuthService.changePassword
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Service: AuthService (MODIFY)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Service: AuthService (MODIFY)
 * Covers criteria: #2, #3 (from run_20260802_172836's prd.md), #2, #3, #4 (from run_20260802_183303's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (user.findUniqueOrThrow, user.update) — no real DB or
 * network call, following catalog.service.spec.ts's established `useValue` mock convention.
 *
 * run_20260802_183303: adds a file-level `jest.mock('bcrypt')` (not needed by the existing
 * `me` tests, which never call bcrypt, so this addition is safe/inert for them) to control
 * `bcrypt.compare`/`bcrypt.hash` deterministically without a real hash computation, plus
 * `changePassword` coverage (new describe block below). The `me` describe block above is
 * carried over byte-identical from run_20260802_172836.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: {
    user: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockJwtService: {
    signAsync: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    mockJwtService = {
      signAsync: jest.fn(),
    };
    mockedBcrypt.compare.mockReset();
    mockedBcrypt.hash.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
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
});
