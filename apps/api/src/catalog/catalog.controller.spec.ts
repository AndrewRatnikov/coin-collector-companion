/**
 * Tests for: CatalogController
 * Contract source: runs/run_20260719_190933/plan.md § Interface Contract (Controller: CatalogController)
 * Covers criteria: #1, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * CatalogService is mocked entirely — this file only proves the controller delegates to the
 * service unchanged and that both handlers carry the @Public() metadata (criterion #1: no
 * auth required). It does not re-test filter/pagination logic, which belongs to
 * catalog.service.spec.ts. No real network/DB call anywhere in this file.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { FindCatalogQueryDto } from './dto/find-catalog-query.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('CatalogController', () => {
  let controller: CatalogController;
  let mockCatalogService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    mockCatalogService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
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
});
