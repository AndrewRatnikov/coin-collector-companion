/**
 * Tests for: AuthService.me
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Service: AuthService (MODIFY)
 * Covers criteria: #2, #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (user.findUniqueOrThrow) — no real DB or network call,
 * following catalog.service.spec.ts's established `useValue` mock convention. This is the
 * first spec file for AuthService — register/login have no prior test coverage to extend,
 * so this file covers only the new `me` method per plan.md's scope (register/login are
 * untouched by this run).
 *
 * The passwordHash-exclusion guarantee (criterion #2) is verified two ways: (1) asserting
 * the exact `select` object passed to `prisma.user.findUniqueOrThrow` never includes
 * `passwordHash`, and (2) asserting the resolved value returned by `me()` — built from a
 * mock Prisma response that only ever contains id/email/createdAt, matching what a real
 * `select: { id: true, email: true, createdAt: true }` query would return — has no
 * passwordHash key.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: {
    user: {
      findUniqueOrThrow: jest.Mock;
    };
  };
  let mockJwtService: {
    signAsync: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUniqueOrThrow: jest.fn(),
      },
    };
    mockJwtService = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('me (criteria #2, #3)', () => {
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
});
