/**
 * Tests for: CatalogController
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Controller: CatalogController)
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Backend — CatalogController (MODIFY)
 * Covers criteria: #1, #9 (from run_20260719_190933's prd.md), #3, #5 (from run_20260725_140648's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * CatalogService is mocked entirely — this file only proves the controller delegates to the
 * service unchanged and carries the right @Public()/guard metadata. It does not re-test
 * filter/dedup/create logic, which belongs to catalog.service.spec.ts. No real network/DB
 * call anywhere in this file.
 *
 * Criterion #5 (unauthenticated POST /catalog -> 401) is verified here at the unit level via
 * the IS_PUBLIC_KEY reflector check (the inverse of the existing @Public() assertions below),
 * not via a live e2e request — this pipeline's sandbox has no DB credentials to bootstrap a
 * real Nest app against (see plan.md's Risks section). Since only @Public() routes bypass the
 * global JwtAuthGuard, an absent/falsy IS_PUBLIC_KEY on `create` proves the guard applies.
 */

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const AUTH_USER: AuthenticatedUser = { userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'collector@example.com' };

describe('CatalogController', () => {
  let controller: CatalogController;
  let mockCatalogService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    mockCatalogService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: mockCatalogService }],
    }).compile();

    controller = module.get(CatalogController);
  });

  describe('@Public() metadata (criterion #1)', () => {
    const reflector = new Reflector();

    it('marks findAll as public (GET /catalog requires no auth)', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findAll)).toBe(true);
    });

    it('marks findOne as public (GET /catalog/:id requires no auth)', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.findOne)).toBe(true);
    });

    it('does NOT mark create as public — POST /catalog requires auth (criterion #5)', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.create)).toBeFalsy();
    });
  });

  describe('findAll', () => {
    it('delegates the query dto to catalogService.findAll and returns its result unchanged', async () => {
      const query = Object.assign(new FindCatalogQueryDto(), { country: 'USA' });
      const serviceResult = { items: [{ id: 'coin-1' }], page: 1, limit: 20, total: 1 };
      mockCatalogService.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(query);

      expect(mockCatalogService.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(serviceResult);
    });
  });

  describe('findOne (criterion #9)', () => {
    it('delegates the id param to catalogService.findOne and returns its result unchanged', async () => {
      const id = '11111111-1111-1111-1111-111111111111';
      const serviceResult = { id, name: 'Lincoln Wheat Cent' };
      mockCatalogService.findOne.mockResolvedValue(serviceResult);

      const result = await controller.findOne(id);

      expect(mockCatalogService.findOne).toHaveBeenCalledWith(id);
      expect(result).toBe(serviceResult);
    });
  });

  describe('create (criteria #3, #4)', () => {
    it('delegates the caller\'s userId and dto to catalogService.create and returns its result unchanged', async () => {
      const dto = Object.assign(new CreateCoinDto(), {
        country: 'USA',
        denomination: '1 Cent',
        name: 'Indian Head Cent',
        year: 1900,
      });
      const serviceResult = { id: 'new-coin-1', status: 'pending' };
      mockCatalogService.create.mockResolvedValue(serviceResult);

      const result = await controller.create(AUTH_USER, dto);

      expect(mockCatalogService.create).toHaveBeenCalledWith(AUTH_USER.userId, dto);
      expect(result).toBe(serviceResult);
    });

    it('propagates a ConflictException thrown by the service unchanged', async () => {
      const dto = Object.assign(new CreateCoinDto(), {
        country: 'USA',
        denomination: '1 Cent',
        name: 'Indian Head Cent',
        year: 1900,
      });
      mockCatalogService.create.mockRejectedValue(new ConflictException('duplicate'));

      await expect(controller.create(AUTH_USER, dto)).rejects.toThrow('duplicate');
    });
  });
});
