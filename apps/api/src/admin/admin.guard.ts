import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';

/**
 * Gates a route to super-admins. Place AFTER the global JwtAuthGuard, which has
 * already authenticated the request and attached the safe user (incl. email) to
 * `req.user`. This guard derives admin status purely from the server-side
 * allowlist + the JWT-authenticated email — it NEVER trusts a client-supplied
 * value (no header/body/`isAdmin` field).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admin: AdminService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { email?: string } | undefined;
    if (!user?.email || !this.admin.isSuperAdmin(user.email)) {
      throw new ForbiddenException('Super-admin access required');
    }
    return true;
  }
}
