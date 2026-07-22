/**
 * Tests for: apps/api/scripts/cleanup-throwaway-users.ts
 * Contract source: runs/run_20260722_121303/plan.md § Interface Contract → Script: cleanup-throwaway-users
 * Covers criteria: #6 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * CleanupPrismaClient is mocked entirely (user.findUnique/delete, userSet.findMany/deleteMany,
 * userSetCoin.deleteMany, ownership.deleteMany) — no real DB connection. `main()` is not
 * exported and is not tested here; per the plan, this script is never sandbox-executed
 * against a real database.
 */

import { deleteUserCascade, parseEmailArgs, type CleanupPrismaClient } from './cleanup-throwaway-users';

function makeMockPrisma(): {
  user: { findUnique: jest.Mock; delete: jest.Mock };
  userSet: { findMany: jest.Mock; deleteMany: jest.Mock };
  userSetCoin: { deleteMany: jest.Mock };
  ownership: { deleteMany: jest.Mock };
} {
  return {
    user: { findUnique: jest.fn(), delete: jest.fn() },
    userSet: { findMany: jest.fn(), deleteMany: jest.fn() },
    userSetCoin: { deleteMany: jest.fn() },
    ownership: { deleteMany: jest.fn() },
  };
}

describe('cleanup-throwaway-users', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('criterion 6: parseEmailArgs', () => {
    it('throws with a usage message when given no arguments', () => {
      expect(() => parseEmailArgs([])).toThrow(
        'Usage: cleanup-throwaway-users.ts <email> [email...]',
      );
    });

    it('returns the trimmed, de-duplicated list of emails', () => {
      const result = parseEmailArgs([' a@example.com ', 'b@example.com', 'a@example.com']);
      expect(result).toEqual(['a@example.com', 'b@example.com']);
    });
  });

  describe('criterion 6: deleteUserCascade — user not found', () => {
    it('returns a found: false, zeroed-out result and calls no delete method', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await deleteUserCascade(prisma as unknown as CleanupPrismaClient, 'ghost@example.com');

      expect(result).toEqual({
        found: false,
        deletedOwnerships: 0,
        deletedSetCoins: 0,
        deletedSets: 0,
      });
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.userSet.deleteMany).not.toHaveBeenCalled();
      expect(prisma.userSetCoin.deleteMany).not.toHaveBeenCalled();
      expect(prisma.ownership.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('criterion 6: deleteUserCascade — user found', () => {
    it('deletes ownerships, that user\'s set-coins, sets, and finally the user, in FK-safe order, returning accurate counts', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'throwaway@example.com' });
      prisma.ownership.deleteMany.mockResolvedValue({ count: 3 });
      prisma.userSet.findMany.mockResolvedValue([{ id: 'set-1' }, { id: 'set-2' }]);
      prisma.userSetCoin.deleteMany.mockResolvedValue({ count: 5 });
      prisma.userSet.deleteMany.mockResolvedValue({ count: 2 });
      prisma.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await deleteUserCascade(prisma as unknown as CleanupPrismaClient, 'throwaway@example.com');

      expect(result).toEqual({
        found: true,
        deletedOwnerships: 3,
        deletedSetCoins: 5,
        deletedSets: 2,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'throwaway@example.com' } });
      expect(prisma.ownership.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.userSet.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.userSetCoin.deleteMany).toHaveBeenCalledWith({
        where: { userSetId: { in: ['set-1', 'set-2'] } },
      });
      expect(prisma.userSet.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });

      // FK-safe order: ownerships/set-coins/sets must be gone before the user row itself is deleted.
      const ownershipCallOrder = prisma.ownership.deleteMany.mock.invocationCallOrder[0];
      const setCoinCallOrder = prisma.userSetCoin.deleteMany.mock.invocationCallOrder[0];
      const setCallOrder = prisma.userSet.deleteMany.mock.invocationCallOrder[0];
      const userCallOrder = prisma.user.delete.mock.invocationCallOrder[0];
      expect(ownershipCallOrder).toBeLessThan(userCallOrder);
      expect(setCoinCallOrder).toBeLessThan(setCallOrder);
      expect(setCallOrder).toBeLessThan(userCallOrder);
    });

    it('deletes no userSetCoin rows and skips the userSetId filter query result gracefully when the user owns no sets', async () => {
      const prisma = makeMockPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'no-sets@example.com' });
      prisma.ownership.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userSet.findMany.mockResolvedValue([]);
      prisma.userSetCoin.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userSet.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.delete.mockResolvedValue({ id: 'user-2' });

      const result = await deleteUserCascade(prisma as unknown as CleanupPrismaClient, 'no-sets@example.com');

      expect(result).toEqual({
        found: true,
        deletedOwnerships: 0,
        deletedSetCoins: 0,
        deletedSets: 0,
      });
      expect(prisma.userSetCoin.deleteMany).toHaveBeenCalledWith({ where: { userSetId: { in: [] } } });
    });
  });
});
