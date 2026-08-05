import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, LoginResponse, RegisteredUser } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import { REFRESH_TOKEN_COOKIE_NAME, clearedRefreshTokenCookieOptions, refreshTokenCookieOptions } from './token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // SD D2 / backlog 2.4: tighter throttle than the app-wide default, scoped to just the two
  // credential-guessing-sensitive routes (not the whole controller — `me`/`refresh`/`logout`/
  // `password` are legitimately called far more than 5x/min in normal use, e.g. every mount
  // of a page that reads the current user).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User created' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() dto: RegisterDto): Promise<RegisteredUser> {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiOkResponse({ description: 'Login succeeded' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions());
    return { accessToken };
  }

  // @Public() — authenticates via the refresh cookie, not the bearer-token guard
  // (backlog_password-management.md Step 2, task 2.5).
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token cookie and mint a new access token' })
  @ApiOkResponse({ description: 'Refresh succeeded' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, expired, or already-rotated refresh token cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    const { accessToken, refreshToken } = await this.authService.refresh(rawRefreshToken);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions());
    return { accessToken };
  }

  // @Public() — authenticates via the refresh cookie, not the bearer-token guard
  // (backlog_password-management.md Step 2, task 2.6). Idempotent: a missing/unknown
  // cookie is a no-op, not an error.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token and clear its cookie' })
  @ApiNoContentResponse({ description: 'Logged out (idempotent)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    await this.authService.logout(rawRefreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearedRefreshTokenCookieOptions());
  }

  // No @Public() — guarded by the global JwtAuthGuard (APP_GUARD in app.module.ts),
  // same convention as CatalogController.create (backlog_password-management.md Step 0).
  @Get('me')
  @ApiOperation({ summary: 'Get the current user' })
  @ApiOkResponse({ description: 'Current user' })
  @ApiUnauthorizedResponse({ description: 'No or invalid access token' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<RegisteredUser> {
    return this.authService.me(user.userId);
  }

  // No @Public() — guarded by the global JwtAuthGuard, same as `me`
  // (backlog_password-management.md Step 1, task 1.1).
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Change the current user's password" })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect, or no/invalid access token' })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.authService.changePassword(user.userId, dto);
  }
}
