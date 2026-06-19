import { useCallback, useEffect, useState } from 'react';
import type { MyInvite } from '@lyra/shared';
import { api } from '../lib/api';

// Pending workspace invites for the current user (notification bell). Backed by
// GET /invites/mine; refetched on window focus and after accept/decline. A fetch
// failure leaves the list empty rather than breaking the nav.
export function useInvites() {
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setInvites(await api<MyInvite[]>('/invites/mine'));
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const accept = useCallback(
    async (id: string) => {
      await api(`/invites/${id}/accept`, { method: 'POST' });
      await refresh();
    },
    [refresh],
  );

  const decline = useCallback(
    async (id: string) => {
      await api(`/invites/${id}/decline`, { method: 'POST' });
      await refresh();
    },
    [refresh],
  );

  return { invites, loading, refresh, accept, decline };
}
