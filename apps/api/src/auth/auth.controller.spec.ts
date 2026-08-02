/**
 * Tests for: AuthController
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Controller: AuthController (MODIFY)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Controller: AuthController (MODIFY)
 *                   runs/run_20260802_221803/plan.md § Interface Contract → Module: apps/api/src/auth/auth.controller.ts (MODIFY)
 * Covers criteria: #1, #3 (from run_20260802_172836's prd.md), #1, #4 (from run_20260802_183303's prd.md),
 *                  #4, #5, #6 (from run_20260802_221803's prd.md)
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
 *
 * run_20260802_221803: adds `refresh`/`logout` handlers (both must have IS_PUBLIC_KEY
 * TRUTHY — the inverse of `me`/`changePassword`'s pattern, since they authenticate via the
 * refresh cookie rather than the bearer-token guard) plus cookie-setting assertions on
 * `login`/`refresh`/`logout` against a mock Express `res` object
 * (`{ cookie: jest.fn(), clearCookie: jest.fn() }`) and a mock `req` object
 * (`{ cookies: {...} }`). Every existing `it`/`describe` block above is carried over
 * byte-identical.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { REFRESH_TOKEN_COOKIE_NAME } from './token.service';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';

const AUTH_USER: AuthenticatedUser = { userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', email: 'collector@example.com' };

function mockResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as import('express').Response;
}

function mockRequest(cookies: Record<string, string> = {}) {
  return { cookies } as unknown as import('express').Request;
}

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    me: jest.Mock;
    changePassword: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
      changePassword: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
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

  describe('@Public() metadata (criteria #4, #5, #6 from run_20260802_221803)', () => {
    const reflector = new Reflector();

    it('marks refresh as public — POST /auth/refresh authenticates via the refresh cookie, not the bearer guard', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.refresh)).toBeTruthy();
    });

    it('marks logout as public — POST /auth/logout authenticates via the refresh cookie, not the bearer guard', () => {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.logout)).toBeTruthy();
    });
  });

  describe('login — refresh cookie (criterion #4 from run_20260802_221803)', () => {
    const dto: LoginDto = { email: 'collector@example.com', password: 'correct-horse' } as LoginDto;

    it('sets the refresh token cookie and returns only { accessToken } in the JSON body', async () => {
      mockAuthService.login.mockResolvedValue({ accessToken: 'access-tok', refreshToken: 'raw-refresh-tok' });
      const res = mockResponse();

      const result = await controller.login(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'raw-refresh-tok', expect.any(Object));
      expect(result).toEqual({ accessToken: 'access-tok' });
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('refresh (criterion #5 from run_20260802_221803)', () => {
    it('reads the refresh cookie, delegates to authService.refresh, and sets the rotated cookie', async () => {
      mockAuthService.refresh.mockResolvedValue({ accessToken: 'new-access-tok', refreshToken: 'new-raw-refresh-tok' });
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'old-raw-refresh-tok' });
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-raw-refresh-tok');
      expect(res.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'new-raw-refresh-tok', expect.any(Object));
      expect(result).toEqual({ accessToken: 'new-access-tok' });
    });

    it('calls authService.refresh with undefined when no cookie is present', async () => {
      mockAuthService.refresh.mockRejectedValue(new Error('No refresh token cookie'));
      const req = mockRequest({});
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow('No refresh token cookie');

      expect(mockAuthService.refresh).toHaveBeenCalledWith(undefined);
    });

    it('propagates a rejection from authService.refresh (e.g. invalid/expired/reused token)', async () => {
      mockAuthService.refresh.mockRejectedValue(new Error('Invalid or expired refresh token'));
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'bad-tok' });
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('logout (criterion #6 from run_20260802_221803)', () => {
    it('reads the refresh cookie, delegates to authService.logout, and clears the cookie', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE_NAME]: 'raw-refresh-tok' });
      const res = mockResponse();

      await controller.logout(req, res);

      expect(mockAuthService.logout).toHaveBeenCalledWith('raw-refresh-tok');
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.any(Object));
    });

    it('is idempotent — still calls logout and clears the cookie when no cookie is present', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = mockRequest({});
      const res = mockResponse();

      await controller.logout(req, res);

      expect(mockAuthService.logout).toHaveBeenCalledWith(undefined);
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.any(Object));
    });
  });
});
