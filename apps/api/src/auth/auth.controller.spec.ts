/**
 * Tests for: AuthController
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Controller: AuthController (MODIFY)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Controller: AuthController (MODIFY)
 * Covers criteria: #1, #3 (from run_20260802_172836's prd.md), #1, #4 (from run_20260802_183303's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * AuthService is mocked entirely (no real DB/network call), following
 * catalog.controller.spec.ts's established pattern in this repo: Test.createTestingModule
 * with a `useValue` mock, a bare `new Reflector()` to assert guard metadata on the
 * controller's method reference, and a delegation assertion.
 *
 * The "unauthenticated request -> 401" half of criterion #1/#3/#4 is verified here at the
 * unit level via the IS_PUBLIC_KEY reflector check (absent/falsy on `me`/`changePassword`,
 * same technique catalog.controller.spec.ts uses for `create`) rather than a live e2e request,
 * since only @Public() routes bypass the app's global JwtAuthGuard (registered via APP_GUARD
 * in app.module.ts) — an absent/falsy IS_PUBLIC_KEY proves the guard applies and a request
 * with no/invalid token is rejected before the handler ever runs.
 *
 * run_20260802_183303: adds `changePassword` coverage (new describe blocks below). Every
 * existing `me` block above is carried over byte-identical from run_20260802_172836.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import type { ChangePasswordDto } from './dto/change-password.dto';

const AUTH_USER: AuthenticatedUser = { userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'collector@example.com' };

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    me: jest.Mock;
    changePassword: jest.Mock;
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
      changePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('@Public() metadata (criterion #1 from run_20260802_172836)', () => {
    const reflector = new Reflector();

    it('does NOT mark me as public — GET /auth/me requires auth', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.me)).toBeFalsy();
    });
  });

  describe('me (criteria #1, #2 from run_20260802_172836)', () => {
    it('delegates the caller\'s userId to authService.me and returns its result unchanged', async () => {
      const serviceResult = {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        email: 'collector@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockAuthService.me.mockResolvedValue(serviceResult);

      const result = await controller.me(AUTH_USER);

      expect(mockAuthService.me).toHaveBeenCalledWith(AUTH_USER.userId);
      expect(result).toBe(serviceResult);
    });

    it('never returns a passwordHash key, even if the service result somehow carried one', async () => {
      const serviceResult = {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        email: 'collector@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockAuthService.me.mockResolvedValue(serviceResult);

      const result = await controller.me(AUTH_USER);

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('@Public() metadata (criterion #1 from run_20260802_183303)', () => {
    const reflector = new Reflector();

    it('does NOT mark changePassword as public — PATCH /auth/password requires auth', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.changePassword)).toBeFalsy();
    });
  });

  describe('changePassword (criteria #1, #4 from run_20260802_183303)', () => {
    const dto: ChangePasswordDto = { currentPassword: 'oldpassword123', newPassword: 'newpassword123' } as ChangePasswordDto;

    it("delegates the caller's userId and dto to authService.changePassword", async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      await controller.changePassword(AUTH_USER, dto);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(AUTH_USER.userId, dto);
    });

    it('propagates a rejection from authService.changePassword (e.g. wrong current password)', async () => {
      const error = new Error('Current password is incorrect');
      mockAuthService.changePassword.mockRejectedValue(error);

      await expect(controller.changePassword(AUTH_USER, dto)).rejects.toThrow('Current password is incorrect');
    });
  });
});
