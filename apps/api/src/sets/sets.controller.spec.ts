/**
 * Tests for: SetsController
 * Contract source: runs/run_20260719_200109/plan.md § Interface Contract (Controller: SetsController)
 * Covers criteria: #1, #2, #8, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * SetsService is mocked entirely — this file only proves the controller delegates to the
 * service unchanged, passes `user.userId` (never a raw user object) as the first service
 * arg, and that no handler carries @Public() metadata (auth required by default on every
 * route in this controller, per the contract). It does not re-test ownership/clone logic,
 * which belongs to sets.service.spec.ts. No real network/DB call anywhere in this file.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('SetsController', () => {
  let controller: SetsController;
  let mockSetsService: {
    findAllForUser: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    mockSetsService = {
      findAllForUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetsController],
      providers: [{ provide: SetsService, useValue: mockSetsService }],
    }).compile();

    controller = module.get(SetsController);
  });

  describe('@Public() metadata — every route requires auth (criteria #1, #2, #8, #9)', () => {
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

  describe('findAll (criterion #1)', () => {
    it('delegates the caller userId to setsService.findAllForUser and returns its result unchanged', async () => {
      const serviceResult = [{ id: 'set-1', userId: 'user-1', name: 'My Set' }];
      mockSetsService.findAllForUser.mockResolvedValue(serviceResult);

      const result = await controller.findAll(user);

      expect(mockSetsService.findAllForUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(serviceResult);
    });
  });

  describe('create (criterion #2)', () => {
    it('delegates the caller userId and dto to setsService.create and returns its result unchanged', async () => {
      const dto = Object.assign(new CreateSetDto(), { name: 'New Set' });
      const serviceResult = { id: 'set-2', userId: 'user-1', name: 'New Set' };
      mockSetsService.create.mockResolvedValue(serviceResult);

      const result = await controller.create(user, dto);

      expect(mockSetsService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(serviceResult);
    });
  });

  describe('update (criterion #8)', () => {
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

  describe('remove (criterion #9)', () => {
    it('delegates the caller userId and id param to setsService.remove', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      mockSetsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(user, id);

      expect(mockSetsService.remove).toHaveBeenCalledWith('user-1', id);
      expect(result).toBeUndefined();
    });
  });
});
