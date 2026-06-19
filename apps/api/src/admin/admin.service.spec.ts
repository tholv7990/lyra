import { AdminService, isSuperAdmin } from './admin.service';

describe('isSuperAdmin (pure allowlist check)', () => {
  it('matches case-insensitively and trims whitespace on both sides', () => {
    const list = ' Ops@Lyra.com , admin@lyra.com ';
    expect(isSuperAdmin('ops@lyra.com', list)).toBe(true);
    expect(isSuperAdmin('  OPS@LYRA.COM  ', list)).toBe(true);
    expect(isSuperAdmin('Admin@Lyra.com', list)).toBe(true);
  });

  it('returns false for an email not on the list', () => {
    expect(isSuperAdmin('nope@lyra.com', 'admin@lyra.com')).toBe(false);
  });

  it('treats an empty/blank allowlist as NOBODY is admin', () => {
    expect(isSuperAdmin('admin@lyra.com', '')).toBe(false);
    expect(isSuperAdmin('admin@lyra.com', '   ,  ')).toBe(false);
  });

  it('returns false for an empty email', () => {
    expect(isSuperAdmin('', 'admin@lyra.com')).toBe(false);
    expect(isSuperAdmin('   ', 'admin@lyra.com')).toBe(false);
  });
});

describe('AdminService', () => {
  function make(envValue: string | undefined) {
    const config = { get: jest.fn().mockReturnValue(envValue) };
    return new AdminService(config as never);
  }

  it('allows an allowlisted email (case-insensitive)', () => {
    const svc = make('admin@lyra.com, ops@lyra.com');
    expect(svc.isSuperAdmin('OPS@lyra.com')).toBe(true);
  });

  it('denies a non-allowlisted email', () => {
    const svc = make('admin@lyra.com');
    expect(svc.isSuperAdmin('intruder@lyra.com')).toBe(false);
  });

  it('denies everyone when SUPER_ADMIN_EMAILS is unset', () => {
    const svc = make(undefined);
    expect(svc.isSuperAdmin('admin@lyra.com')).toBe(false);
  });
});
