import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';

// Runs after the global JwtAuthGuard, so request.user is already populated for any
// non-@Public() route. The role is read from the database on every call (never from the
// JWT and never cached), so a demotion takes effect on the very next request.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const record = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
    if (!record) {
      throw new UnauthorizedException();
    }

    if (!required.includes(record.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
