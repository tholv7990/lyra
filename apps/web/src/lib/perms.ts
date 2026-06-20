import { canCreate, type WorkspaceView } from '@lyra/shared';

// Web reflection of the api's create gate (invariant 4 — same shared helper). True
// when the caller's role in the current workspace may create content / run; false
// for a Viewer. Used to hide create affordances (the api still enforces).
export function canCreateIn(ws: WorkspaceView | null | undefined): boolean {
  return !!ws && canCreate({ userId: '', role: ws.role, canManageKeys: ws.canManageKeys });
}
