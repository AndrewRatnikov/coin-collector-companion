/**
 * Tests for: apps/api/scripts/set-user-role.ts
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Script: set-user-role (CREATE)
 * Covers criteria: #2 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * SetUserRolePrismaClient is mocked entirely (user.findUnique / user.update): no real DB.
 * `main()` is not exported and is not tested here.
 */

import {
  SET_USER_ROLE_USAGE,
  parseSetUserRoleArgs,
  setUserRole,
  type SetUserRolePrismaClient,
} from './set-user-role';

function makeMockPrisma(): { user: { findUnique: jest.Mock; update: jest.Mock } } {
  return { user: { findUnique: jest.fn(), update: jest.fn() } };
}

describe('set-user-role', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SET_USER_ROLE_USAGE', () => {
    it('is the documented usage line', () => {
      expect(SET_USER_ROLE_USAGE).toBe('Usage: set-user-role.ts <email> <user|admin>');
    });
  });

  describe('parseSetUserRoleArgs', () => {
    it('returns the trimmed email and the role for valid arguments', () => {
      expect(parseSetUserRoleArgs(['  owner@example.com  ', 'admin'])).toEqual({
        email: 'owner@example.com',
        role: 'admin',
      });
    });

    it('accepts the "user" role too (different output from "admin")', () => {
      expect(parseSetUserRoleArgs(['owner@example.com', 'user'])).toEqual({
        email: 'owner@example.com',
        role: 'user',
      });
    });

    it('throws the usage message when given no arguments', () => {
      expect(() => parseSetUserRoleArgs([])).toThrow(SET_USER_ROLE_USAGE);
    });

    it('throws the usage message when given only an email', () => {
      expect(() => parseSetUserRoleArgs(['owner@example.com'])).toThrow(SET_USER_ROLE_USAGE);
    });

    it('throws the usage message when given more than two arguments', () => {
      expect(() => parseSetUserRoleArgs(['owner@example.com', 'admin', 'extra'])).toThrow(SET_USER_ROLE_USAGE);
    });

    it('throws the usage message when the email is blank after trimming', () => {
      expect(() => parseSetUserRoleArgs(['   ', 'admin'])).toThrow(SET_USER_ROLE_USAGE);
    });

    it('throws a clear message naming the invalid role', () => {
      expect(() => parseSetUserRoleArgs(['owner@example.com', 'superuser'])).toThrow(
        'Invalid role "superuser". Expected one of: user, admin',
      );
    });

    it('treats the role as case-sensitive ("Admin" is invalid)', () => {
      expect(() => parseSetUserRoleArgs(['owner@example.com', 'Admin'])).toThrow(
        'Invalid role "Admin". Expected one of: user, admin',
      );
    });
  });

  describe('setUserRole — user not found', () => {
    it('returns { found: false } and performs no update', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await setUserRole(prisma as unknown as SetUserRolePrismaClient, 'ghost@example.com', 'admin');

      expect(result).toEqual({ found: false });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('setUserRole — user found', () => {
    it('looks the user up by email selecting id and role', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'user' });
      prisma.user.update.mockResolvedValue({});

      await setUserRole(prisma as unknown as SetUserRolePrismaClient, 'owner@example.com', 'admin');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'owner@example.com' },
        select: { id: true, role: true },
      });
    });

    it('promotes: updates by id with the new role and reports previousRole -> role', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'user' });
      prisma.user.update.mockResolvedValue({});

      const result = await setUserRole(prisma as unknown as SetUserRolePrismaClient, 'owner@example.com', 'admin');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { role: 'admin' } });
      expect(result).toEqual({ found: true, previousRole: 'user', role: 'admin' });
    });

    it('demotes: reports the real previous role (admin -> user), for a different user id', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', role: 'admin' });
      prisma.user.update.mockResolvedValue({});

      const result = await setUserRole(prisma as unknown as SetUserRolePrismaClient, 'other@example.com', 'user');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-2' }, data: { role: 'user' } });
      expect(result).toEqual({ found: true, previousRole: 'admin', role: 'user' });
    });

    it('looks up before it updates', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'user' });
      prisma.user.update.mockResolvedValue({});

      await setUserRole(prisma as unknown as SetUserRolePrismaClient, 'owner@example.com', 'admin');

      expect(prisma.user.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.user.update.mock.invocationCallOrder[0],
      );
    });
  });
});
