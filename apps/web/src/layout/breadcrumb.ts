import { createContext, useContext, useEffect } from 'react';

// Detail pages call useBreadcrumb(<record name>) to fill the topbar's
// "‹ Module / Record" breadcrumb. List pages don't call it, so the crumb is the
// module name only. The provider (AppLayout) owns the state.
export const BreadcrumbContext = createContext<(record: string | null) => void>(
  () => {},
);

// Opens the app nav drawer. Full-bleed pages that hide the app top bar (the
// chat) use this to give mobile users a way back to the menu. AppLayout provides it.
export const AppNavContext = createContext<() => void>(() => {});
export function useAppNav(): () => void {
  return useContext(AppNavContext);
}

export function useBreadcrumb(record: string | null): void {
  const set = useContext(BreadcrumbContext);
  useEffect(() => {
    set(record);
    return () => set(null);
  }, [set, record]);
}
