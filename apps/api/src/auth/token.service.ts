import { randomBytes, randomUUID, createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

const REFRESH_TOKEN_TTL_MS = 20 * 24 * 60 * 60 * 1000; // 20 days (backlog_password-management.md decision 5)

export interface IssuedRefreshToken {
  rawToken: string;
  familyId: string;
  expiresAt: Date;
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function refreshTokenCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

export function clearedRefreshTokenCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: 'lax' as const,
    path: '/',
  };
}

// backlog_password-management.md Step 2 — rotating, server-revocable refresh tokens.
// Raw tokens are never persisted, only a sha256 hash (no bcrypt cost factor needed: these
// are already-high-entropy random 32-byte tokens, not user-chosen passwords).
@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, familyId?: string): Promise<IssuedRefreshToken> {
    const rawToken = randomBytes(32).toString('hex');
    const resolvedFamilyId = familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        familyId: resolvedFamilyId,
        expiresAt,
      },
    });

    return { rawToken, familyId: resolvedFamilyId, expiresAt };
  }

  async rotate(rawToken: string): Promise<{ userId: string; email: string } & IssuedRefreshToken> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true } } },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated-out token signals theft — revoke the whole chain,
      // not just this row (backlog_password-management.md decision 5).
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const issued = await this.issue(existing.userId, existing.familyId);
    return { userId: existing.userId, email: existing.user.email, ...issued };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // updateMany (not update) so revoking an unknown/already-revoked token is a silent
  // no-op rather than a thrown P2025 — this is what makes POST /auth/logout idempotent.
  async revokeOne(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
