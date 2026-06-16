import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { WorkspaceView, CreateWorkspaceDto } from '@lyra/shared';
import { api, setWorkspaceId } from '../lib/api';
import { useAuth } from '../auth/useAuth';

const LS_KEY = 'lyra.workspaceId';

interface WorkspaceContextValue {
  workspaces: WorkspaceView[];
  current: WorkspaceView | null;
  loading: boolean;
  setCurrent: (id: string) => void;
  refresh: () => Promise<void>;
  createWorkspace: (dto: CreateWorkspaceDto) => Promise<WorkspaceView>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceView[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() =>
    localStorage.getItem(LS_KEY),
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = await api<WorkspaceView[]>('/workspaces');
    setWorkspaces(list);
  }, []);

  // Load the user's workspaces when authenticated; clear on logout.
  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentId(null);
      setWorkspaceId(null);
      return;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  // Keep a valid current workspace selected (default: personal, else first).
  useEffect(() => {
    if (workspaces.length === 0) return;
    const valid = currentId && workspaces.some((w) => w.id === currentId);
    const next = valid
      ? currentId!
      : (workspaces.find((w) => w.type === 'personal')?.id ?? workspaces[0].id);
    if (next !== currentId) setCurrentId(next);
    setWorkspaceId(next);
    localStorage.setItem(LS_KEY, next);
  }, [workspaces, currentId]);

  const setCurrent = useCallback((id: string) => {
    setCurrentId(id);
    setWorkspaceId(id);
    localStorage.setItem(LS_KEY, id);
  }, []);

  const createWorkspace = useCallback(
    async (dto: CreateWorkspaceDto) => {
      const ws = await api<WorkspaceView>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await refresh();
      setCurrent(ws.id);
      return ws;
    },
    [refresh, setCurrent],
  );

  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? null,
    [workspaces, currentId],
  );

  const value = useMemo(
    () => ({
      workspaces,
      current,
      loading,
      setCurrent,
      refresh,
      createWorkspace,
    }),
    [workspaces, current, loading, setCurrent, refresh, createWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
