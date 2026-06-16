import { Role, ProjectVisibility } from '../enums';

export interface MemberCtx {
  userId: string;
  role: Role;
  canManageKeys: boolean;
}

// Access helpers take the owner's user id (a string), not the transport Project
// — whose createdBy is a populated UserRef. Server-side passes the stored id;
// client-side passes project.createdBy.id.
export interface ProjectAccess {
  createdBy: string;
  visibility: ProjectVisibility;
  sharedWith: string[];
}

export function canViewProject(p: ProjectAccess, ctx: MemberCtx): boolean {
  if (ctx.role === Role.Owner) return true; // owner override
  if (p.createdBy === ctx.userId) return true;
  if (p.visibility === ProjectVisibility.Workspace) return true;
  if (p.visibility === ProjectVisibility.Shared) {
    return p.sharedWith.includes(ctx.userId);
  }
  return false; // private, not creator
}

export function canEditProject(
  p: { createdBy: string },
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
