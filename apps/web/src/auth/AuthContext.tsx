import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User, SignupDto, LoginDto } from '@lyra/shared';
import { api, setAccessToken, bootstrapSession } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (dto: LoginDto) => Promise<void>;
  signup: (dto: SignupDto) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = { accessToken: string; user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Silent session restore on load: try refresh, then fetch the current user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await bootstrapSession();
      if (ok && !cancelled) {
        try {
          const { user } = await api<{ user: User }>('/auth/me');
          if (!cancelled) setUser(user);
        } catch {
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (dto: LoginDto) => {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (dto: SignupDto) => {
    const res = await api<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', retry: false });
    } catch {
      // best-effort — clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
