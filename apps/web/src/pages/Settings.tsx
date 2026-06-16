import { useEffect, useState } from 'react';
import { Provider, canManageKeys, type ApiKeyInfo } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CheckIcon, TrashIcon } from '../layout/icons';

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
  const [toRemove, setToRemove] = useState<Provider | null>(null);
  const [removing, setRemoving] = useState(false);

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

  async function confirmRemove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await remove(toRemove);
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <div className="prompts-head">
        <div className="titles">
          <h2>Provider keys</h2>
          <p>
            Bring-your-own keys, encrypted at rest per workspace. Each pipeline step unlocks once its provider key is set.
            {!canManage && ' You need Owner or key-management permission to change these.'}
          </p>
        </div>
      </div>

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
                    {p.label}
                    <span className="key-set">
                      <span className={`key-dot ${existing ? 'on' : ''}`} />
                      {existing ? `Key set ···· ${existing.last4}` : 'Not set'}
                    </span>
                  </div>
                  <div className="sub">{p.hint}</div>
                </div>
                {canManage && (
                  <div className="row-actions">
                    <input
                      className="text-input key-input"
                      type="password"
                      placeholder={existing ? '••••••••••  replace' : 'Paste key'}
                      value={drafts[p.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <button
                      className="icon-btn-primary"
                      title="Save key"
                      disabled={!(drafts[p.id] ?? '').trim()}
                      onClick={() => void save(p.id)}
                    >
                      <CheckIcon width={16} height={16} />
                    </button>
                    {existing && (
                      <button className="icon-btn-danger" title="Remove key" onClick={() => setToRemove(p.id)}>
                        <TrashIcon width={16} height={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toRemove}
        title="Remove key?"
        message={
          <>
            Remove the <strong>{toRemove}</strong> key for this workspace? Steps using it will lock until a new key is set.
          </>
        }
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
