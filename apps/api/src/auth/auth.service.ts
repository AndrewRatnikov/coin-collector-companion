import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

const BCRYPT_COST = 10;

export interface RegisteredUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface LoginResponse {
  accessToken: string;
}

// Internal to the auth module — carries the raw refresh token the controller needs to set
// as a cookie, without it ever reaching the public LoginResponse JSON shape.
export interface LoginResult extends LoginResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    try {
      return await this.prisma.user.create({
        data: { email: dto.email, passwordHash },
        select: { id: true, email: true, createdAt: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email });
    const { rawToken: refreshToken } = await this.tokenService.issue(user.id);
    return { accessToken, refreshToken };
  }

  // POST /auth/refresh (backlog_password-management.md Step 2, task 2.5). The "missing
  // cookie" 401 is checked here, before ever calling TokenService.rotate — mirrors how
  // changePassword's validation already lives in the service, not the controller.
  async refresh(rawRefreshToken?: string): Promise<LoginResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No refresh token cookie');
    }

    const rotated = await this.tokenService.rotate(rawRefreshToken);
    const accessToken = await this.jwtService.signAsync({ sub: rotated.userId, email: rotated.email });
    return { accessToken, refreshToken: rotated.rawToken };
  }

  // POST /auth/logout (backlog_password-management.md Step 2, task 2.6). Never throws —
  // a missing/unknown cookie is a silent no-op, which is what makes logout idempotent.
  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      await this.tokenService.revokeOne(rawRefreshToken);
    }
  }

  // GET /auth/me (backlog_password-management.md Step 0, decision 10). `select` excludes
  // passwordHash at the query level — same defense-in-depth reasoning CatalogService's
  // submittedByUserId omission follows — never rely on the controller alone to keep a
  // sensitive field out of the response.
  async me(userId: string): Promise<RegisteredUser> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true },
    });
  }

  // PATCH /auth/password (backlog_password-management.md Step 1, task 1.1). Retrofitted in
  // Step 2 (task 2.7) to also revoke every other active session on a successful change,
  // now that the refresh-token table this needs actually exists — Step 1 shipped without it
  // on purpose (decision 3).
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokenService.revokeAllForUser(userId);
  }
}
