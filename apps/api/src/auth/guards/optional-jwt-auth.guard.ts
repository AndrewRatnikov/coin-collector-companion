import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';

// Route-level guard (applied via @UseGuards() on GET /catalog only — does not touch
// AppModule's global APP_GUARD array). @nestjs/passport's AuthGuard mixin's canActivate
// always returns true regardless of what handleRequest returns (it only assigns
// request.user = handleRequest(...)'s result and never itself throws unless handleRequest
// does) — overriding handleRequest to never throw means a missing/invalid/expired token is
// treated as "anonymous", not "reject the request".
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser | undefined>(
    _err: unknown,
    user: AuthenticatedUser | false,
    _info: unknown,
    _context: ExecutionContext,
    _status?: number,
  ): TUser {
    return (user || undefined) as TUser;
  }
}
