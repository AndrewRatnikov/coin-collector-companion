/**
 * Tests for: SetsService
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Service: SetsService)
 * Covers criteria: #1, #3, #4, #5, #6, #7, #8, #9, #10 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (userSet.*, userSetCoin.*, canonicalSetCoin.findMany,
 * $transaction) — no real DB or network call. Per plan.md's "Recommended Prisma mock shape"
 * note, `$transaction` is mocked to invoke its callback with the same mock object used
 * elsewhere, so assertions on e.g. `mockPrismaService.userSet.create` work whether the
 * implementation calls it via the outer `this.prisma` or the transaction callback's `tx`
 * argument — both resolve to the identical mock in this harness (a known limitation of
 * unit-level Prisma transaction testing, documented in plan.md's Risks section; it does not
 * change what is asserted here).
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SetsService } from './sets.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SetsService', () => {
  let service: SetsService;
  let mockPrismaService: {
    userSet: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    userSetCoin: {
      findMany: jest.Mock;
      createMany: jest.Mock;
    };
    canonicalSetCoin: {
      findMany: jest.Mock;
    };
    ownership: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrismaService = {
      userSet: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userSetCoin: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      canonicalSetCoin: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ownership: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SetsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(SetsService);
  });

  describe('findAllForUser (criterion #1)', () => {
    it('scopes the query to the given userId', async () => {
      await service.findAllForUser('user-1');

      const call = mockPrismaService.userSet.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('user-1');
    });

    it('returns whatever prisma resolves', async () => {
      const rows = [{ id: 'set-1', userId: 'user-1', name: 'My Set' }];
      mockPrismaService.userSet.findMany.mockResolvedValue(rows);

      const result = await service.findAllForUser('user-1');

      expect(result).toBe(rows);
    });
  });

  describe('create — blank set (criterion #3)', () => {
    it('creates a UserSet with no cloneFrom and never touches userSetCoin or $transaction', async () => {
      const created = { id: 'set-new', userId: 'user-1', name: 'Blank Set' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', { name: 'Blank Set' } as never);

      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', name: 'Blank Set' }),
        }),
      );
      expect(mockPrismaService.userSetCoin.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });
  });

  describe('create — clone from canonical set (criteria #4, #6, #7)', () => {
    it('copies CanonicalSetCoin rows verbatim (positions not renumbered) and sets clonedFromCanonicalId', async () => {
      const sourceId = '33333333-3333-3333-3333-333333333333';
      const sourceCoins = [
        { id: 'csc-1', canonicalSetId: sourceId, coinId: 'coin-a', position: 1 },
        { id: 'csc-2', canonicalSetId: sourceId, coinId: 'coin-b', position: 5 },
      ];
      mockPrismaService.canonicalSetCoin.findMany.mockResolvedValue(sourceCoins);
      const created = { id: 'set-clone', userId: 'user-1', name: 'Cloned Set' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', {
        name: 'Cloned Set',
        cloneFrom: { type: 'canonical', id: sourceId },
      } as never);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.canonicalSetCoin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ canonicalSetId: sourceId }) }),
      );
      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'Cloned Set',
            clonedFromCanonicalId: sourceId,
            clonedFromUserSetId: null,
          }),
        }),
      );
      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-a', position: 1 }),
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-b', position: 5 }),
        ]),
      );
      expect(result).toBe(created);
    });
  });

  describe('create — clone from user set (criteria #5, #6, #7)', () => {
    it('copies UserSetCoin rows from ANY set id (no owner filter) and sets clonedFromUserSetId', async () => {
      const sourceId = '44444444-4444-4444-4444-444444444444';
      const sourceCoins = [{ id: 'usc-1', userSetId: sourceId, coinId: 'coin-c', position: 2 }];
      mockPrismaService.userSetCoin.findMany.mockResolvedValue(sourceCoins);
      const created = { id: 'set-clone-2', userId: 'user-1', name: 'Cloned From User' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      const result = await service.create('user-1', {
        name: 'Cloned From User',
        cloneFrom: { type: 'user', id: sourceId },
      } as never);

      const findManyCall = mockPrismaService.userSetCoin.findMany.mock.calls[0][0];
      expect(findManyCall.where.userSetId).toBe(sourceId);
      expect(findManyCall.where.userId).toBeUndefined();
      expect(mockPrismaService.userSet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clonedFromUserSetId: sourceId,
            clonedFromCanonicalId: null,
          }),
        }),
      );
      const createManyArg = mockPrismaService.userSetCoin.createMany.mock.calls[0][0];
      expect(createManyArg.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userSetId: created.id, coinId: 'coin-c', position: 2 }),
        ]),
      );
      expect(result).toBe(created);
    });

    it('succeeds without throwing when the source set has zero coins', async () => {
      mockPrismaService.userSetCoin.findMany.mockResolvedValue([]);
      const created = { id: 'set-clone-3', userId: 'user-1', name: 'Empty Clone' };
      mockPrismaService.userSet.create.mockResolvedValue(created);

      await expect(
        service.create('user-1', {
          name: 'Empty Clone',
          cloneFrom: { type: 'user', id: '55555555-5555-5555-5555-555555555555' },
        } as never),
      ).resolves.toBe(created);
    });
  });

  describe('update — ownership check (criterion #8)', () => {
    const id = '66666666-6666-6666-6666-666666666666';

    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.update('user-1', id, { name: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.userSet.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the set belongs to a different user', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'someone-else' });

      await expect(service.update('user-1', id, { name: 'X' } as never)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.userSet.update).not.toHaveBeenCalled();
    });

    it('updates the name when the caller owns the set', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });
      const updated = { id, userId: 'user-1', name: 'Renamed' };
      mockPrismaService.userSet.update.mockResolvedValue(updated);

      const result = await service.update('user-1', id, { name: 'Renamed' } as never);

      expect(mockPrismaService.userSet.update).toHaveBeenCalledWith({
        where: { id },
        data: { name: 'Renamed' },
      });
      expect(result).toBe(updated);
    });
  });

  describe('remove — ownership check and Ownership isolation (criteria #9, #10)', () => {
    const id = '77777777-7777-7777-7777-777777777777';

    it('throws NotFoundException when no UserSet with that id exists', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', id)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.userSet.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the set belongs to a different user', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'someone-else' });

      await expect(service.remove('user-1', id)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.userSet.delete).not.toHaveBeenCalled();
    });

    it('deletes the UserSet row when the caller owns it, and never touches prisma.ownership', async () => {
      mockPrismaService.userSet.findUnique.mockResolvedValue({ id, userId: 'user-1' });

      await service.remove('user-1', id);

      expect(mockPrismaService.userSet.delete).toHaveBeenCalledWith({ where: { id } });
      expect(mockPrismaService.ownership.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.upsert).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.ownership.deleteMany).not.toHaveBeenCalled();
    });
  });
});
