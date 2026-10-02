/**
 * Tests for: RolesGuard, Roles decorator
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Guard: RolesGuard, Decorator: Roles
 * Covers criteria: #3, #4 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService and Reflector are plain mocks: no real DB. The guard is instantiated directly
 * with its two constructor dependencies (Reflector, PrismaService), as given by the contract.
 */

import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY, Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

const USER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function makeContext(user: { userId: string; email: string } | undefined): ExecutionContext {
  const handler = function handler() {};
  class FakeController {}
  return {
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new RolesGuard(reflector as unknown as Reflector, prisma as unknown as PrismaService);
  });

  it('reads the required roles from ROLES_KEY on the handler and the class', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    const ctx = makeContext({ userId: USER_ID, email: 'a@example.com' });

    await guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
  });

  it('throws UnauthorizedException for an anonymous request (no request.user) without querying the DB', async () => {
    const ctx = makeContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for a user whose DB role is "user"', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'user' });

    await expect(guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns true for a user whose DB role is "admin"', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    await expect(guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }))).resolves.toBe(true);
  });

  it('looks the role up by the request user id, selecting only role', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    await guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: USER_ID }, select: { role: true } });
  });

  it('uses the id of the current request user (a different user id yields a different lookup)', async () => {
    const otherId = '9b2f1c3e-6a47-4d8e-8f10-2c5d7e9a1b34';
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    await guard.canActivate(makeContext({ userId: otherId, email: 'b@example.com' }));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: otherId }, select: { role: true } });
    expect(prisma.user.findUnique).not.toHaveBeenCalledWith({ where: { id: USER_ID }, select: { role: true } });
  });

  it('throws UnauthorizedException when the user no longer exists in the DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('applies a demotion on the very next request with the same user (admin then user)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: 'admin' }).mockResolvedValueOnce({ role: 'user' });
    const sameRequestUser = { userId: USER_ID, email: 'a@example.com' };

    await expect(guard.canActivate(makeContext(sameRequestUser))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext(sameRequestUser))).rejects.toThrow(ForbiddenException);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns true and makes no Prisma call when there is no roles metadata (undefined)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns true and makes no Prisma call when the roles metadata is an empty array', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows a user when their role is any one of several required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(['user', 'admin']);
    prisma.user.findUnique.mockResolvedValue({ role: 'user' });

    await expect(guard.canActivate(makeContext({ userId: USER_ID, email: 'a@example.com' }))).resolves.toBe(true);
  });
});

describe('Roles decorator', () => {
  it('exposes ROLES_KEY as "roles"', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('stores the given roles under ROLES_KEY on the decorated class', () => {
    @Roles('admin')
    class AdminOnly {}

    @Roles('user', 'admin')
    class Both {}

    expect(Reflect.getMetadata(ROLES_KEY, AdminOnly)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, Both)).toEqual(['user', 'admin']);
  });
});
