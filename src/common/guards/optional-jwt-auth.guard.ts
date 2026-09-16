import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Like JwtAuthGuard, but never rejects: canActivate() always returns true
// (inherited), and this only controls what request.user ends up as — the
// real user for a valid Bearer token, undefined for a missing/invalid one
// (passport's jwt strategy signals that with `false`), instead of throwing
// 401. Used on routes a guest may call (e.g. the free scan quota), where the
// handler itself decides what to do with an anonymous caller.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  public handleRequest<TUser = unknown>(
    _err: unknown,
    user: unknown,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ): TUser {
    return (user || undefined) as TUser;
  }
}
