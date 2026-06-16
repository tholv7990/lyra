import { useCallback, useEffect, useState } from 'react';
import { MODEL_CATALOG, Provider, type ModelOption } from '@lyra/shared';
import { api } from './api';

export type ModelCatalog = Record<Provider, ModelOption[]>;

// The effective per-provider model catalog for a workspace: the models refreshed
// live from each provider's API (saved in the DB), falling back to the built-in
// MODEL_CATALOG for providers that haven't been refreshed. Powers the model
// pickers in the playground and pipeline builder. Returns the static catalog
// immediately, then swaps in the server's effective catalog once loaded.
export function useModels(wsId: string | undefined): {
  catalog: ModelCatalog;
  reload: () => void;
} {
  const [catalog, setCatalog] = useState<ModelCatalog>(MODEL_CATALOG);

  const reload = useCallback(() => {
    if (!wsId) return;
    api<ModelCatalog>(`/workspaces/${wsId}/models`)
      .then((c) => c && setCatalog(c))
      .catch(() => {
        /* keep built-in defaults on error */
      });
  }, [wsId]);

  useEffect(() => {
    setCatalog(MODEL_CATALOG);
    reload();
  }, [reload]);

  return { catalog, reload };
}
