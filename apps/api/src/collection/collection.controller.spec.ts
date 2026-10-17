/**
 * Tests for: CollectionController
 * Contract source: runs/run_20260720_142942/plan.md § Interface Contract (Controller: CollectionController)
 * Extended by: runs/run_20261017_210503/plan.md § Interface Contract (API: PATCH /collection)
 * Covers criteria: #1, #7 (run_20260720_142942); #10 (run_20261017_210503)
 *
 * CONTRACT_GAP: none.
 *
 * CollectionService is mocked entirely — this file only proves the controller delegates to
 * the service unchanged, passes `user.userId` (never a raw user object) as the first service
 * arg on every handler, and that no handler carries @Public() metadata (all require
 * auth per the Interface Contract). It does not re-test upsert/deleteMany/filter logic, which
 * belongs to collection.service.spec.ts. No real network/DB call anywhere in this file.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { SetOwnershipDto } from './dto/set-ownership.dto';
import { BulkSetOwnershipDto } from './dto/bulk-set-ownership.dto';
import { FindCollectionQueryDto } from './dto/find-collection-query.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('CollectionController', () => {
  let controller: CollectionController;
  let mockCollectionService: {
    findAll: jest.Mock;
    setOwnership: jest.Mock;
    setOwnershipBulk: jest.Mock;
  };

  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    mockCollectionService = {
      findAll: jest.fn(),
      setOwnership: jest.fn(),
      setOwnershipBulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [{ provide: CollectionService, useValue: mockCollectionService }],
    }).compile();

    controller = module.get(CollectionController);
  });

  describe('@Public() metadata — all routes require auth (criteria #1, #7, #10)', () => {
    const reflector = new Reflector();

    it('does not mark findAll as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findAll)).toBeFalsy();
    });

    it('does not mark setOwnership as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.setOwnership)).toBeFalsy();
    });

    it('does not mark setOwnershipBulk as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.setOwnershipBulk)).toBeFalsy();
    });
  });

  describe('findAll (criteria #7, #8)', () => {
    it('delegates the caller userId and query dto to collectionService.findAll and returns its result unchanged', async () => {
      const query = Object.assign(new FindCollectionQueryDto(), { country: 'USA' });
      const serviceResult = [
        {
          coinId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          coin: { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', country: 'USA' },
          ownedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
      mockCollectionService.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(user, query);

      expect(mockCollectionService.findAll).toHaveBeenCalledWith('user-1', query);
      expect(result).toBe(serviceResult);
    });
  });

  describe('setOwnership (criteria #1, #2, #3, #4, #5, #6)', () => {
    it('delegates the caller userId, coinId param, and dto.owned to collectionService.setOwnership and returns its result unchanged', async () => {
      const coinId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
      const dto = Object.assign(new SetOwnershipDto(), { owned: true });
      const serviceResult = {
        coinId,
        owned: true,
        ownedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockCollectionService.setOwnership.mockResolvedValue(serviceResult);

      const result = await controller.setOwnership(user, coinId, dto);

      expect(mockCollectionService.setOwnership).toHaveBeenCalledWith('user-1', coinId, true);
      expect(result).toBe(serviceResult);
    });

    it('passes owned: false through unchanged', async () => {
      const coinId = 'e2c56db5-dffb-48d3-b1c4-63c7981a9b46';
      const dto = Object.assign(new SetOwnershipDto(), { owned: false });
      const serviceResult = { coinId, owned: false, ownedAt: null };
      mockCollectionService.setOwnership.mockResolvedValue(serviceResult);

      const result = await controller.setOwnership(user, coinId, dto);

      expect(mockCollectionService.setOwnership).toHaveBeenCalledWith('user-1', coinId, false);
      expect(result).toBe(serviceResult);
    });
  });

  describe('setOwnershipBulk (criterion #10)', () => {
    const idA = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const idB = '9b2e4f1c-8d3a-4c5b-a6e7-1f2d3c4b5a69';

    it('delegates user.userId, dto.coinIds and dto.owned and returns the service result unchanged', async () => {
      const dto = Object.assign(new BulkSetOwnershipDto(), { coinIds: [idA, idB], owned: true });
      const serviceResult = { coinIds: [idA, idB], owned: true };
      mockCollectionService.setOwnershipBulk.mockResolvedValue(serviceResult);

      const result = await controller.setOwnershipBulk(user, dto);

      expect(mockCollectionService.setOwnershipBulk).toHaveBeenCalledTimes(1);
      expect(mockCollectionService.setOwnershipBulk).toHaveBeenCalledWith(
        'user-1',
        [idA, idB],
        true,
      );
      expect(result).toBe(serviceResult);
    });

    it('passes owned: false through unchanged', async () => {
      const dto = Object.assign(new BulkSetOwnershipDto(), { coinIds: [idB], owned: false });
      mockCollectionService.setOwnershipBulk.mockResolvedValue({ coinIds: [idB], owned: false });

      await controller.setOwnershipBulk(user, dto);

      expect(mockCollectionService.setOwnershipBulk).toHaveBeenCalledWith('user-1', [idB], false);
    });
  });
});
