/**
 * Tests for: JwtStrategy.validate
 * Contract source: runs/run_20261001_214421/plan.md § Interface Contract → Strategy: JwtStrategy (MODIFY)
 * Covers criteria: #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked with only `user.findUnique`; ConfigService is a stub whose
 * getOrThrow returns a fixed secret. No real DB or network.
 */

import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy.validate', () => {
  let mockPrisma: { user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    mockPrisma = { user: { findUnique: jest.fn() } };
    strategy = new JwtStrategy(
      { getOrThrow: () => 'test-secret' } as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
    );
  });

  it('looks the user up by payload.sub with a minimal id-only select, exactly once', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await strategy.validate({ sub: 'user-1', email: 'a@example.com' } as never);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: { id: true } });
  });

  it('returns { userId, email } from the payload when the user exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    const first = await strategy.validate({ sub: 'user-1', email: 'a@example.com' } as never);

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    const second = await strategy.validate({ sub: 'user-2', email: 'b@example.com' } as never);

    expect(first).toEqual({ userId: 'user-1', email: 'a@example.com' });
    expect(second).toEqual({ userId: 'user-2', email: 'b@example.com' });
  });

  it('throws UnauthorizedException when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'deleted-user', email: 'gone@example.com' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
