/**
 * Tests for: TokenService
 * Contract source: runs/run_20260802_221803/plan.md § Interface Contract → Module: apps/api/src/auth/token.service.ts (CREATE)
 * Covers criteria: #3, #6, #7, #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (refreshToken.create/findUnique/update/updateMany) — no
 * real DB, following auth.service.spec.ts's established `useValue` mock convention. Token
 * hashing is verified against the REAL `crypto` module (imported directly in this test, not
 * mocked) by independently recomputing sha256(rawToken) and comparing it to what was passed
 * to Prisma — proves the service actually hashes rather than trivially satisfying a mocked
 * assertion.
 */

import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('TokenService', () => {
  let service: TokenService;
  let mockPrismaService: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(TokenService);
  });

  describe('issue (criteria #3, #8)', () => {
    it('creates a RefreshToken row whose tokenHash is the sha256 of the returned rawToken', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.issue('user-1');

      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrismaService.refreshToken.create.mock.calls[0][0];
      expect(callArgs.data.tokenHash).toBe(sha256(result.rawToken));
      expect(callArgs.data.userId).toBe('user-1');
    });

    it('generates a new uuid-shaped familyId when none is given', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.issue('user-1');

      expect(result.familyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      const callArgs = mockPrismaService.refreshToken.create.mock.calls[0][0];
      expect(callArgs.data.familyId).toBe(result.familyId);
    });

    it('reuses the given familyId when one is provided instead of generating a new one', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.issue('user-1', 'family-abc');

      expect(result.familyId).toBe('family-abc');
      const callArgs = mockPrismaService.refreshToken.create.mock.calls[0][0];
      expect(callArgs.data.familyId).toBe('family-abc');
    });

    it('sets expiresAt to roughly 20 days in the future', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({});
      const before = Date.now();

      const result = await service.issue('user-1');

      const expectedMs = 20 * 24 * 60 * 60 * 1000;
      const deltaFromExpected = result.expiresAt.getTime() - before - expectedMs;
      expect(Math.abs(deltaFromExpected)).toBeLessThan(5000); // 5s tolerance for test execution time
    });
  });

  describe('rotate — happy path (criteria #3, #8)', () => {
    it('revokes the used token and issues a new one in the same family, returning the owning user', async () => {
      const rawToken = 'raw-token-value';
      const tokenHash = sha256(rawToken);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: 'user-1',
        familyId: 'family-abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { email: 'collector@example.com' },
      });
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate(rawToken);

      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        include: { user: { select: { email: true } } },
      });
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.userId).toBe('user-1');
      expect(result.email).toBe('collector@example.com');
      expect(result.familyId).toBe('family-abc');
      expect(result.rawToken).not.toBe(rawToken);
    });

    it('never calls updateMany on the happy path (no family-wide revocation)', async () => {
      const rawToken = 'raw-token-value';
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: sha256(rawToken),
        userId: 'user-1',
        familyId: 'family-abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { email: 'collector@example.com' },
      });
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.rotate(rawToken);

      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('rotate — reuse detection (criteria #3, #8)', () => {
    it('revokes every row in the familyId and rejects with UnauthorizedException when the token was already revoked', async () => {
      const rawToken = 'raw-token-value';
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: sha256(rawToken),
        userId: 'user-1',
        familyId: 'family-abc',
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { email: 'collector@example.com' },
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.rotate(rawToken)).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-abc', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not issue a replacement token when reuse is detected', async () => {
      const rawToken = 'raw-token-value';
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: sha256(rawToken),
        userId: 'user-1',
        familyId: 'family-abc',
        revokedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { email: 'collector@example.com' },
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.rotate(rawToken)).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('rotate — not found / expired (criterion #3)', () => {
    it('rejects with UnauthorizedException when no matching token exists', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.rotate('unknown-token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects with UnauthorizedException when the token is expired', async () => {
      const rawToken = 'raw-token-value';
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: sha256(rawToken),
        userId: 'user-1',
        familyId: 'family-abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { email: 'collector@example.com' },
      });

      await expect(service.rotate(rawToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeAllForUser (criteria #6, #7, #8)', () => {
    it('revokes every active token for the user via a single updateMany', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeAllForUser('user-1');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not throw when the user has no active tokens', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeAllForUser('user-1')).resolves.toBeUndefined();
    });
  });

  describe('revokeOne (criterion #6)', () => {
    it('revokes the matching token by its hash via updateMany', async () => {
      const rawToken = 'raw-token-value';
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revokeOne(rawToken);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256(rawToken), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not throw (silent no-op) when the token is unknown or already revoked', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeOne('unknown-token')).resolves.toBeUndefined();
    });
  });
});
