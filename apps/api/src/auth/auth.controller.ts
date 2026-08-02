import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
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
import { AuthService, LoginResponse, RegisteredUser } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

// SD D2 / backlog 2.4: tighter throttle on auth routes than the app-wide default
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User created' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() dto: RegisterDto): Promise<RegisteredUser> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiOkResponse({ description: 'Login succeeded' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
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
