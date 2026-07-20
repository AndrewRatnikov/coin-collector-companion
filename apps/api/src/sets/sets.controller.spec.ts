/**
 * Tests for: SetsController
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Controller: SetsController)
 *                   runs/run_20260720_070901/plan.md § Interface Contract (Controller: SetsController)
 * Covers criteria: #1, #2, #8, #9 (from runs/run_20260719_200109/prd.md)
 *                   #1, #2, #7, #8, #9, #10, #11, #12 (from runs/run_20260720_070901/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * SetsService is mocked entirely — this file only proves the controller delegates to the
 * service unchanged, passes `user.userId` (never a raw user object) as the first service
 * arg on owner-scoped handlers, and that @Public() metadata is present/absent exactly where
 * the Interface Contract says it should be. It does not re-test ownership/clone/dedup/pagination
 * logic, which belongs to sets.service.spec.ts. Route *declaration order* (PRD criterion #13/#14)
 * is explicitly a manual-pass concern per plan.md's Interface Contract and Risks section — it
 * requires a live HTTP server to observe NestJS's actual route matching, which a direct
 * controller-instance unit test (no HTTP layer) cannot exercise. No real network/DB call
 * anywhere in this file.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { PatchSetCoinsDto } from './dto/patch-set-coins.dto';
import { FindPublicSetsQueryDto } from './dto/find-public-sets-query.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('SetsController', () => {
  let controller: SetsController;
  let mockSetsService: {
    findAllForUser: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    patchCoins: jest.Mock;
    findAllCanonical: jest.Mock;
    findCanonicalById: jest.Mock;
    findAllPublic: jest.Mock;
    findPublicById: jest.Mock;
  };

  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    mockSetsService = {
      findAllForUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      patchCoins: jest.fn(),
      findAllCanonical: jest.fn(),
      findCanonicalById: jest.fn(),
      findAllPublic: jest.fn(),
      findPublicById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetsController],
      providers: [{ provide: SetsService, useValue: mockSetsService }],
    }).compile();

    controller = module.get(SetsController);
  });

  describe('@Public() metadata — auth-required routes (criteria #1, #2, #8, #9 from run_20260719_200109/prd.md)', () => {
    const reflector = new Reflector();

    it('does not mark findAll as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findAll)).toBeFalsy();
    });

    it('does not mark create as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.create)).toBeFalsy();
    });

    it('does not mark update as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.update)).toBeFalsy();
    });

    it('does not mark remove as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.remove)).toBeFalsy();
    });
  });

  describe('@Public() metadata — new routes (criteria #8, #9, #10, #11, #1 from run_20260720_070901/prd.md)', () => {
    const reflector = new Reflector();

    it('marks findAllCanonical as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findAllCanonical)).toBe(true);
    });

    it('marks findCanonicalById as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findCanonicalById)).toBe(true);
    });

    it('marks findAllPublic as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findAllPublic)).toBe(true);
    });

    it('marks findPublicById as public', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findPublicById)).toBe(true);
    });

    it('does NOT mark patchCoins as public (owner-only write, criterion #1)', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.patchCoins)).toBeFalsy();
    });
  });

  describe('findAll (criterion #1 from run_20260719_200109/prd.md)', () => {
    it('delegates the caller userId to setsService.findAllForUser and returns its result unchanged', async () => {
      const serviceResult = [{ id: 'set-1', userId: 'user-1', name: 'My Set' }];
      mockSetsService.findAllForUser.mockResolvedValue(serviceResult);

      const result = await controller.findAll(user);

      expect(mockSetsService.findAllForUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(serviceResult);
    });
  });

  describe('create (criterion #2 from run_20260719_200109/prd.md)', () => {
    it('delegates the caller userId and dto to setsService.create and returns its result unchanged', async () => {
      const dto = Object.assign(new CreateSetDto(), { name: 'New Set' });
      const serviceResult = { id: 'set-2', userId: 'user-1', name: 'New Set' };
      mockSetsService.create.mockResolvedValue(serviceResult);

      const result = await controller.create(user, dto);

      expect(mockSetsService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('update (criterion #8 from run_20260719_200109/prd.md)', () => {
    it('delegates the caller userId, id param, and dto to setsService.update and returns its result unchanged', async () => {
      const id = '11111111-1111-1111-1111-111111111111';
      const dto = Object.assign(new UpdateSetDto(), { name: 'Renamed' });
      const serviceResult = { id, userId: 'user-1', name: 'Renamed' };
      mockSetsService.update.mockResolvedValue(serviceResult);

      const result = await controller.update(user, id, dto);

      expect(mockSetsService.update).toHaveBeenCalledWith('user-1', id, dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('remove (criterion #9 from run_20260719_200109/prd.md)', () => {
    it('delegates the caller userId and id param to setsService.remove', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      mockSetsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(user, id);

      expect(mockSetsService.remove).toHaveBeenCalledWith('user-1', id);
      expect(result).toBeUndefined();
    });
  });

  describe('patchCoins (criteria #1, #2, #7 from run_20260720_070901/prd.md)', () => {
    it('delegates the caller userId, id param, and dto to setsService.patchCoins and returns its result unchanged', async () => {
      const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      const dto = Object.assign(new PatchSetCoinsDto(), {
        add: ['7c9e6679-7425-40de-944b-e07fc1f90ae7'],
      });
      const serviceResult = [
        { id: 'usc-1', userSetId: id, coinId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', position: 1 },
      ];
      mockSetsService.patchCoins.mockResolvedValue(serviceResult);

      const result = await controller.patchCoins(user, id, dto);

      expect(mockSetsService.patchCoins).toHaveBeenCalledWith('user-1', id, dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('findAllCanonical (criterion #8 from run_20260720_070901/prd.md)', () => {
    it('delegates to setsService.findAllCanonical with no arguments and returns its result unchanged', async () => {
      const serviceResult = [
        { id: 'cs-1', name: 'Lincoln Cents', description: null, source: 'admin', templateVersion: '1' },
      ];
      mockSetsService.findAllCanonical.mockResolvedValue(serviceResult);

      const result = await controller.findAllCanonical();

      expect(mockSetsService.findAllCanonical).toHaveBeenCalledWith();
      expect(result).toBe(serviceResult);
    });
  });

  describe('findCanonicalById (criterion #9 from run_20260720_070901/prd.md)', () => {
    it('delegates the id param to setsService.findCanonicalById and returns its result unchanged', async () => {
      const id = '44444444-4444-4444-4444-444444444444';
      const serviceResult = {
        id,
        name: 'Lincoln Cents',
        description: null,
        source: 'admin',
        templateVersion: '1',
        coins: [],
      };
      mockSetsService.findCanonicalById.mockResolvedValue(serviceResult);

      const result = await controller.findCanonicalById(id);

      expect(mockSetsService.findCanonicalById).toHaveBeenCalledWith(id);
      expect(result).toBe(serviceResult);
    });
  });

  describe('findAllPublic (criteria #10, #12 from run_20260720_070901/prd.md)', () => {
    it('delegates the query dto to setsService.findAllPublic and returns its result unchanged', async () => {
      const query = Object.assign(new FindPublicSetsQueryDto(), { page: 2, limit: 10 });
      const serviceResult = { items: [], page: 2, limit: 10, total: 0 };
      mockSetsService.findAllPublic.mockResolvedValue(serviceResult);

      const result = await controller.findAllPublic(query);

      expect(mockSetsService.findAllPublic).toHaveBeenCalledWith(query);
      expect(result).toBe(serviceResult);
    });
  });

  describe('findPublicById (criteria #11, #12 from run_20260720_070901/prd.md)', () => {
    it('delegates the id param to setsService.findPublicById and returns its result unchanged', async () => {
      const id = '55555555-5555-5555-5555-555555555555';
      const serviceResult = {
        id,
        userId: 'user-2',
        name: 'A Public Set',
        clonedFromCanonicalId: null,
        clonedFromUserSetId: null,
        coins: [],
      };
      mockSetsService.findPublicById.mockResolvedValue(serviceResult);

      const result = await controller.findPublicById(id);

      expect(mockSetsService.findPublicById).toHaveBeenCalledWith(id);
      expect(result).toBe(serviceResult);
    });
  });
});
