/**
 * Tests for: AdminController
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Controller: AdminController (CREATE)
 * Covers criteria: #3, #6, #8, #10 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * AdminService is mocked; RolesGuard is overridden with an allow-all stub so the controller's
 * delegation can be tested without a DB. The class-level @Roles('admin') + @UseGuards(RolesGuard)
 * wiring is asserted through Nest's reflected metadata.
 */

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FindAdminCoinsQueryDto } from './dto/find-admin-coins-query.dto';
import { ReviewCoinDto } from './dto/review-coin.dto';

const COIN_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const OTHER_COIN_ID = '9b2f1c3e-6a47-4d8e-8f10-2c5d7e9a1b34';

describe('AdminController', () => {
  let controller: AdminController;
  let mockAdminService: { findCoins: jest.Mock; reviewCoin: jest.Mock };

  beforeEach(async () => {
    mockAdminService = {
      findCoins: jest.fn(),
      reviewCoin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminController);
  });

  describe('access control wiring (criterion #3)', () => {
    it('declares @Roles("admin") at class level', () => {
      expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['admin']);
    });

    it('applies RolesGuard at class level', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) as unknown[];
      expect(guards).toContain(RolesGuard);
    });
  });

  describe('findCoins (criterion #6)', () => {
    it('passes the query through to AdminService.findCoins and returns its result unchanged', async () => {
      const query = Object.assign(new FindAdminCoinsQueryDto(), { status: 'pending' as const, page: 2, limit: 5 });
      const expected = { items: [{ id: 'p1' }], page: 2, limit: 5, total: 11 };
      mockAdminService.findCoins.mockResolvedValue(expected);

      const result = await controller.findCoins(query);

      expect(mockAdminService.findCoins).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });

    it('forwards a different query object (not a fixed argument)', async () => {
      const query = Object.assign(new FindAdminCoinsQueryDto(), { status: 'rejected' as const });
      mockAdminService.findCoins.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

      await controller.findCoins(query);

      expect(mockAdminService.findCoins).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
    });
  });

  describe('reviewCoin (criteria #8, #10)', () => {
    it('passes the id and dto through to AdminService.reviewCoin and returns its result unchanged', async () => {
      const dto = Object.assign(new ReviewCoinDto(), { status: 'rejected' as const, rejectionReason: 'Blurry' });
      const expected = { id: COIN_ID, status: 'rejected' };
      mockAdminService.reviewCoin.mockResolvedValue(expected);

      const result = await controller.reviewCoin(COIN_ID, dto);

      expect(mockAdminService.reviewCoin).toHaveBeenCalledWith(COIN_ID, dto);
      expect(result).toBe(expected);
    });

    it('forwards a different id and dto (not fixed arguments)', async () => {
      const dto = Object.assign(new ReviewCoinDto(), { status: 'approved' as const });
      mockAdminService.reviewCoin.mockResolvedValue({ id: OTHER_COIN_ID });

      await controller.reviewCoin(OTHER_COIN_ID, dto);

      expect(mockAdminService.reviewCoin).toHaveBeenCalledWith(OTHER_COIN_ID, dto);
      expect(mockAdminService.reviewCoin).not.toHaveBeenCalledWith(COIN_ID, dto);
    });

    it('propagates a rejection from the service', async () => {
      mockAdminService.reviewCoin.mockRejectedValue(new Error('boom'));

      await expect(controller.reviewCoin(COIN_ID, Object.assign(new ReviewCoinDto(), { status: 'approved' as const }))).rejects.toThrow(
        'boom',
      );
    });
  });
});
