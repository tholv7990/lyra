import { createContext, useContext, useEffect } from 'react';

// Overrides the path-derived module segment of the breadcrumb (label + link).
// e.g. a chat opened from a prompt points its crumb back to /prompts, not /chats.
export type BreadcrumbParent = { label: string; to: string };
export type BreadcrumbState = {
  record: string | null;
  parent: BreadcrumbParent | null;
};

// Detail pages call useBreadcrumb(<record name>) to fill the topbar's
// "‹ Module / Record" breadcrumb. List pages don't call it, so the crumb is the
// module name only. The provider (AppLayout) owns the state.
export const BreadcrumbContext = createContext<(state: BreadcrumbState) => void>(
  () => {},
);

// Opens the app nav drawer. Full-bleed pages that hide the app top bar (the
// chat) use this to give mobile users a way back to the menu. AppLayout provides it.
export const AppNavContext = createContext<() => void>(() => {});
export function useAppNav(): () => void {
  return useContext(AppNavContext);
}

export function useBreadcrumb(
  record: string | null,
  parent: BreadcrumbParent | null = null,
): void {
  const set = useContext(BreadcrumbContext);
  // Depend on the primitive fields, not the object identity, so callers can pass
  // an inline `{ label, to }` without re-firing the effect every render.
  const label = parent?.label ?? null;
  const to = parent?.to ?? null;
  useEffect(() => {
    set({ record, parent: label && to ? { label, to } : null });
    return () => set({ record: null, parent: null });
  }, [set, record, label, to]);
}
