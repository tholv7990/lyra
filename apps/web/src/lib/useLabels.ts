import { useCallback, useEffect, useState } from 'react';
import { tagKey, type LabelInfo } from '@lyra/shared';
import { api } from './api';

// The workspace's label vocabulary (name + saved colour). Powers the label
// picker and resolves colours wherever tags render. Mirrors useModels: fetches
// on mount, exposes a reload and an optimistic createLabel.
export function useLabels(wsId: string | undefined): {
  labels: LabelInfo[];
  reload: () => void;
  createLabel: (name: string, color: string) => Promise<LabelInfo | null>;
} {
  const [labels, setLabels] = useState<LabelInfo[]>([]);

  const reload = useCallback(() => {
    if (!wsId) return;
    api<LabelInfo[]>(`/workspaces/${wsId}/labels`)
      .then((l) => l && setLabels(l))
      .catch(() => {
        /* no labels yet / offline — keep current */
      });
  }, [wsId]);

  useEffect(() => {
    setLabels([]);
    reload();
  }, [reload]);

  const createLabel = useCallback(
    async (name: string, color: string): Promise<LabelInfo | null> => {
      if (!wsId) return null;
      const created = await api<LabelInfo>(`/workspaces/${wsId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name, color }),
      });
      setLabels((prev) => {
        const others = prev.filter((l) => tagKey(l.name) !== tagKey(created.name));
        return [...others, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      return created;
    },
    [wsId],
  );

  return { labels, reload, createLabel };
}
