/**
 * Tests for: CatalogController, OptionalJwtAuthGuard, OptionalCurrentUser
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Controller: CatalogController)
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Backend — CatalogController (MODIFY)
 *                   runs/run_20260731_132040/plan.md § Interface Contract → Controller: CatalogController.findAll (MODIFY),
 *                     Guard: OptionalJwtAuthGuard, Decorator: OptionalCurrentUser
 * Covers criteria: #1, #9 (from run_20260719_190933's prd.md), #3, #5 (from run_20260725_140648's prd.md),
 *                  #1, #2, #3 (from run_20260731_132040's prd.md)
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
 *
 * run_20260731_132040: findAll now takes a second `@OptionalCurrentUser()` param, and the
 * anonymous-vs-authenticated behavior of OptionalJwtAuthGuard.handleRequest (never throws,
 * returns undefined instead) is unit-tested directly below per plan.md's Interface Contract —
 * OptionalJwtAuthGuard is imported from its exact contract path
 * (apps/api/src/auth/guards/optional-jwt-auth.guard.ts), no new file/name is invented.
 */

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { CreateCoinDto } from './dto/create-coin.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
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
    it('delegates the query dto and no userId to catalogService.findAll when no user is present (anonymous, run_20260731_132040 criterion #2)', async () => {
      const query = Object.assign(new FindCatalogQueryDto(), { country: 'USA' });
      const serviceResult = { items: [{ id: 'coin-1' }], page: 1, limit: 20, total: 1 };
      mockCatalogService.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(query, undefined);

      expect(mockCatalogService.findAll).toHaveBeenCalledWith(query, undefined);
      expect(result).toBe(serviceResult);
    });

    it('delegates the caller\'s userId to catalogService.findAll when an authenticated user is present (run_20260731_132040 criterion #1)', async () => {
      const query = Object.assign(new FindCatalogQueryDto(), { submittedByMe: true });
      const serviceResult = { items: [{ id: 'coin-pending' }], page: 1, limit: 20, total: 1 };
      mockCatalogService.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(query, AUTH_USER);

      expect(mockCatalogService.findAll).toHaveBeenCalledWith(query, AUTH_USER.userId);
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

  describe('OptionalJwtAuthGuard.handleRequest (run_20260731_132040 criteria #1, #2)', () => {
    let guard: OptionalJwtAuthGuard;

    beforeEach(() => {
      guard = new OptionalJwtAuthGuard();
    });

    it('returns the authenticated user unchanged when Passport resolves one (valid token)', () => {
      const result = guard.handleRequest(null, AUTH_USER, null, {} as never, undefined);
      expect(result).toBe(AUTH_USER);
    });

    it('returns undefined instead of throwing when no user is resolved (missing token)', () => {
      const result = guard.handleRequest(null, false, null, {} as never, undefined);
      expect(result).toBeUndefined();
    });

    it('returns undefined instead of throwing when Passport reports an error (invalid/expired token)', () => {
      const result = guard.handleRequest(new Error('jwt expired'), false, null, {} as never, undefined);
      expect(result).toBeUndefined();
    });
  });
});
