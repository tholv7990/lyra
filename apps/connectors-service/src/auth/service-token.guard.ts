import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const expected = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const got = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!expected || got !== expected) throw new UnauthorizedException('bad service token');
    return true;
  }
}
