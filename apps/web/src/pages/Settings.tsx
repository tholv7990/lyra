import { useEffect, useState } from 'react';
import { Provider, canManageKeys, type ApiKeyInfo } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: Provider.OpenAI, label: 'OpenAI', hint: 'GPT-5.5 — Find sources' },
  { id: Provider.Anthropic, label: 'Anthropic', hint: 'Claude — Brain steps' },
  { id: Provider.DeepSeek, label: 'DeepSeek', hint: 'Crawl & extract' },
  { id: Provider.Image, label: 'Image', hint: 'Image generation' },
  { id: Provider.Video, label: 'Video', hint: 'Video / UGC' },
];

export function Settings() {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [keys, setKeys] = useState<Record<string, ApiKeyInfo>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsId = current?.id;
  const canManage =
    !!current &&
    !!user &&
    canManageKeys({ userId: user.id, role: current.role, canManageKeys: current.canManageKeys });

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<ApiKeyInfo[]>(`/workspaces/${wsId}/keys`)
      .then((list) => {
        if (cancelled) return;
        setKeys(Object.fromEntries(list.map((k) => [k.provider, k])));
      })
      .catch(() => !cancelled && setKeys({}))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  async function save(provider: Provider) {
    const key = (drafts[provider] ?? '').trim();
    if (!wsId || !key) return;
    setError(null);
    try {
      const info = await api<ApiKeyInfo>(`/workspaces/${wsId}/keys/${provider}`, {
        method: 'PUT',
        body: JSON.stringify({ key }),
      });
      setKeys((k) => ({ ...k, [provider]: info }));
      setDrafts((d) => ({ ...d, [provider]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save key');
    }
  }

  async function remove(provider: Provider) {
    if (!wsId) return;
    await api(`/workspaces/${wsId}/keys/${provider}`, { method: 'DELETE' });
    setKeys((k) => {
      const next = { ...k };
      delete next[provider];
      return next;
    });
  }

  return (
    <div>
      <div className="section-head">
        <h2>Provider keys</h2>
      </div>
      <p className="empty" style={{ textAlign: 'left', padding: '0 0 16px' }}>
        Bring-your-own keys, encrypted at rest per workspace. Each pipeline step unlocks once its provider key is set.
        {!canManage && ' You need Owner or key-management permission to change these.'}
      </p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading keys…</p>
      ) : (
        <div className="list">
          {PROVIDERS.map((p) => {
            const existing = keys[p.id];
            return (
              <div className="row" key={p.id}>
                <div className="grow">
                  <div className="title">
                    {p.label}{' '}
                    {existing ? (
                      <span className="badge" style={{ marginLeft: 6 }}>•••• {existing.last4}</span>
                    ) : (
                      <span className="badge" style={{ marginLeft: 6 }}>Not set</span>
                    )}
                  </div>
                  <div className="sub">{p.hint}</div>
                </div>
                {canManage && (
                  <div className="row-actions">
                    <input
                      className="text-input select-sm"
                      type="password"
                      placeholder={existing ? 'Replace key' : 'Paste key'}
                      value={drafts[p.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={() => void save(p.id)}>
                      Save
                    </button>
                    {existing && (
                      <button className="btn-ghost" onClick={() => void remove(p.id)}>Remove</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
