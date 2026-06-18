import { ServiceTokenGuard } from './service-token.guard';
import { UnauthorizedException } from '@nestjs/common';

function ctx(auth?: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers: auth ? { authorization: auth } : {} }) }) } as never;
}

describe('ServiceTokenGuard', () => {
  const guard = new ServiceTokenGuard({ get: () => 'sekret' } as never);
  it('allows the right bearer token', () => {
    expect(guard.canActivate(ctx('Bearer sekret'))).toBe(true);
  });
  it('rejects a missing/wrong token', () => {
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx('Bearer nope'))).toThrow(UnauthorizedException);
  });
});
