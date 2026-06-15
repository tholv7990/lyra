import { Role, ProjectVisibility } from '../enums';
import type { Project } from '../models';

export interface MemberCtx {
  userId: string;
  role: Role;
  canManageKeys: boolean;
}

export function canViewProject(
  p: Pick<Project, 'createdBy' | 'visibility' | 'sharedWith'>,
  ctx: MemberCtx,
): boolean {
  if (ctx.role === Role.Owner) return true; // owner override
  if (p.createdBy === ctx.userId) return true;
  if (p.visibility === ProjectVisibility.Workspace) return true;
  if (p.visibility === ProjectVisibility.Shared) {
    return p.sharedWith.includes(ctx.userId);
  }
  return false; // private, not creator
}

export function canEditProject(
  p: Pick<Project, 'createdBy'>,
  ctx: MemberCtx,
): boolean {
  return ctx.role === Role.Owner || p.createdBy === ctx.userId;
}

export function canManageKeys(ctx: MemberCtx): boolean {
  return ctx.role === Role.Owner || ctx.canManageKeys;
}

export function fillPrompt(
  tmpl: string,
  vars: { product?: string; niche?: string; homepage?: string },
): string {
  return tmpl
    .replace(/{product}/g, vars.product?.trim() || '{product}')
    .replace(/{niche}/g, vars.niche?.trim() || '{niche}')
    .replace(/{homepage}/g, vars.homepage?.trim() || '{homepage}');
}
