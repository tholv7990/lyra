import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Pure allowlist check. The allowlist is a comma-separated list of operator
 * emails (from SUPER_ADMIN_EMAILS). Comparison is case-insensitive and
 * whitespace-trimmed on both sides. An empty/blank allowlist means NOBODY is an
 * admin — this is the safe default when the env var is unset.
 */
export function isSuperAdmin(email: string, allowlist: string): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
    .includes(target);
}

/**
 * The ONLY source of truth for super-admin status. Reads SUPER_ADMIN_EMAILS
 * from config and matches against it server-side. Admin status is NEVER read
 * from request input and never persisted as a settable field — it is derived
 * purely from the JWT-authenticated email + this env allowlist.
 */
@Injectable()
export class AdminService {
  constructor(private readonly config: ConfigService) {}

  isSuperAdmin(email: string): boolean {
    const allowlist = this.config.get<string>('SUPER_ADMIN_EMAILS') ?? '';
    return isSuperAdmin(email, allowlist);
  }
}
