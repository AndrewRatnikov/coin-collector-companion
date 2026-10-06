/**
 * Tests for: CollectionImportController
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Controller: collection-import.controller.ts)
 * Covers criteria: #1, #10 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * CollectionImportService is mocked entirely. This file proves delegation (user.userId, file, mapping,
 * dto.coinIds), that neither route is @Public() (so the global JwtAuthGuard applies), the route paths and
 * 200 status codes, the throttle metadata (checked the way src/rate-limits.spec.ts does) and that the
 * preview route has an upload interceptor attached. No real network or DB.
 */

import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CollectionImportController } from './collection-import.controller';
import { CollectionImportService, type UploadedCsvFile } from './collection-import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { PreviewImportDto } from './dto/preview-import.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const limitOf = (fn: unknown): unknown => Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
const ttlOf = (fn: unknown): unknown => Reflect.getMetadata('THROTTLER:TTLdefault', fn as object);

describe('CollectionImportController', () => {
  let controller: CollectionImportController;
  let mockService: { preview: jest.Mock; confirm: jest.Mock };

  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };
  const file: UploadedCsvFile = {
    buffer: Buffer.from('Year,Country,Denomination\n1950,USA,Cent\n'),
    size: 41,
    originalname: 'coins.csv',
    mimetype: 'text/csv',
  };

  beforeEach(async () => {
    mockService = { preview: jest.fn(), confirm: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionImportController],
      providers: [{ provide: CollectionImportService, useValue: mockService }],
    }).compile();
    controller = module.get(CollectionImportController);
  });

  describe('routing metadata', () => {
    it('is mounted at collection/import with POST preview and POST confirm', () => {
      expect(Reflect.getMetadata('path', CollectionImportController)).toBe('collection/import');
      expect(Reflect.getMetadata('path', CollectionImportController.prototype.preview)).toBe('preview');
      expect(Reflect.getMetadata('path', CollectionImportController.prototype.confirm)).toBe('confirm');
      // RequestMethod.POST === 1
      expect(Reflect.getMetadata('method', CollectionImportController.prototype.preview)).toBe(1);
      expect(Reflect.getMetadata('method', CollectionImportController.prototype.confirm)).toBe(1);
    });

    it('answers both routes with HTTP 200', () => {
      expect(Reflect.getMetadata('__httpCode__', CollectionImportController.prototype.preview)).toBe(200);
      expect(Reflect.getMetadata('__httpCode__', CollectionImportController.prototype.confirm)).toBe(200);
    });

    it('attaches an interceptor (the file upload) to preview but not to confirm', () => {
      const previewInterceptors = Reflect.getMetadata('__interceptors__', CollectionImportController.prototype.preview);
      expect(Array.isArray(previewInterceptors)).toBe(true);
      expect(previewInterceptors).toHaveLength(1);
      expect(Reflect.getMetadata('__interceptors__', CollectionImportController.prototype.confirm)).toBeUndefined();
    });
  });

  describe('auth (criterion #1)', () => {
    const reflector = new Reflector();

    it('does not mark preview or confirm as public, on the handler or the class', () => {
      for (const handler of [controller.preview, controller.confirm]) {
        expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBeFalsy();
      }
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, CollectionImportController)).toBeFalsy();
    });
  });

  describe('throttle metadata (criterion #10)', () => {
    it.each([
      ['preview', CollectionImportController.prototype.preview, 10, 60_000],
      ['confirm', CollectionImportController.prototype.confirm, 5, 60_000],
    ])('%s has limit %d per %d ms', (_name, handler, limit, ttl) => {
      expect(limitOf(handler)).toBe(limit);
      expect(ttlOf(handler)).toBe(ttl);
    });
  });

  describe('preview', () => {
    it('delegates the caller userId, the uploaded file and the mapping string, returning the result unchanged', async () => {
      const serviceResult = { headers: ['Year'], delimiter: ',', mapping: {}, rows: [], summary: {} };
      mockService.preview.mockResolvedValue(serviceResult);
      const body = Object.assign(new PreviewImportDto(), { mapping: '{"year":0}' });

      const result = await controller.preview(user, file, body);

      expect(mockService.preview).toHaveBeenCalledTimes(1);
      expect(mockService.preview).toHaveBeenCalledWith('user-1', file, '{"year":0}');
      expect(result).toBe(serviceResult);
    });

    it('passes undefined for a missing file and a missing mapping (service decides the error)', async () => {
      mockService.preview.mockResolvedValue({});
      await controller.preview({ userId: 'user-2', email: 'b@example.com' }, undefined, new PreviewImportDto());
      expect(mockService.preview).toHaveBeenCalledWith('user-2', undefined, undefined);
    });

    it('propagates service errors', async () => {
      mockService.preview.mockRejectedValue(new Error('boom'));
      await expect(controller.preview(user, file, new PreviewImportDto())).rejects.toThrow('boom');
    });
  });

  describe('confirm', () => {
    it('delegates the caller userId and dto.coinIds, returning the result unchanged', async () => {
      const serviceResult = { requested: 2, created: 1, alreadyOwned: 1 };
      mockService.confirm.mockResolvedValue(serviceResult);
      const dto = Object.assign(new ConfirmImportDto(), {
        coinIds: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', '7c9e6679-7425-40de-944b-e07fc1f90ae7'],
      });

      const result = await controller.confirm(user, dto);

      expect(mockService.confirm).toHaveBeenCalledTimes(1);
      expect(mockService.confirm).toHaveBeenCalledWith('user-1', dto.coinIds);
      expect(result).toBe(serviceResult);
    });

    it('uses the userId of the authenticated user, not a value from the body', async () => {
      mockService.confirm.mockResolvedValue({ requested: 1, created: 1, alreadyOwned: 0 });
      const dto = Object.assign(new ConfirmImportDto(), { coinIds: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] });
      await controller.confirm({ userId: 'user-77', email: 'c@example.com' }, dto);
      expect(mockService.confirm).toHaveBeenCalledWith('user-77', dto.coinIds);
    });
  });
});
