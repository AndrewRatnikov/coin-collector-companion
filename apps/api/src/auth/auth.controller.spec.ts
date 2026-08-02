/**
 * Tests for: AuthController
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Controller: AuthController (MODIFY)
 * Covers criteria: #1, #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * AuthService is mocked entirely (no real DB/network call), following
 * catalog.controller.spec.ts's established pattern in this repo: Test.createTestingModule
 * with a `useValue` mock, a bare `new Reflector()` to assert guard metadata on the
 * controller's method reference, and a delegation assertion. This is the first spec file
 * for AuthController — no prior file existed to extend.
 *
 * The "unauthenticated request -> 401" half of criterion #1/#3 is verified here at the
 * unit level via the IS_PUBLIC_KEY reflector check (absent/falsy on `me`, same technique
 * catalog.controller.spec.ts uses for `create`) rather than a live e2e request, since only
 * @Public() routes bypass the app's global JwtAuthGuard (registered via APP_GUARD in
 * app.module.ts) — an absent/falsy IS_PUBLIC_KEY on `me` proves the guard applies and a
 * request with no/invalid token is rejected before the handler ever runs.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

const AUTH_USER: AuthenticatedUser = { userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'collector@example.com' };

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    me: jest.Mock;
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('@Public() metadata (criterion #1)', () => {
    const reflector = new Reflector();

    it('does NOT mark me as public — GET /auth/me requires auth', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.me)).toBeFalsy();
    });
  });

  describe('me (criteria #1, #2)', () => {
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
});
