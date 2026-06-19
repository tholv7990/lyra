import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider, canManageKeys, type ApiKeyInfo, type ModelOption } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LanguageToggleButton, ThemeToggleButton } from '../components/PrefControls';
import { CheckIcon, RefreshIcon, XIcon } from '../layout/icons';

// `keyUrl` points at each provider's API-key console so a new user can find
// their key without leaving the flow. Image reuses the OpenAI key (no separate
// image key — see keyProviderFor in shared); Video is still a mock, no key.
const PROVIDERS: { id: Provider; label: string; hint: string; keyUrl?: string }[] = [
  { id: Provider.OpenAI, label: 'OpenAI', hint: 'GPT-5.5 — Find sources', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: Provider.Anthropic, label: 'Anthropic', hint: 'Claude — Brain steps', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: Provider.DeepSeek, label: 'DeepSeek', hint: 'Crawl & extract', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: Provider.Image, label: 'Image', hint: 'Image generation — uses your OpenAI key', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: Provider.Video, label: 'Video', hint: 'Video / UGC' },
];
const LABEL: Record<Provider, string> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.label]),
) as Record<Provider, string>;
const MASKED_KEY_VALUE = '••••••••••';

// Providers that expose a live /models listing we can fetch and save.
const LISTABLE: Provider[] = [Provider.OpenAI, Provider.Anthropic, Provider.DeepSeek];

export function Settings() {
  const { t } = useTranslation();
  const { user, changePassword } = useAuth();
  const { current } = useWorkspace();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys] = useState<Record<string, ApiKeyInfo>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys] = useState<Partial<Record<Provider, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toSave, setToSave] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [toRemove, setToRemove] = useState<Provider | null>(null);
  const [removing, setRemoving] = useState(false);
  const [models, setModels] = useState<Partial<Record<Provider, ModelOption[]>>>({});
  const [refreshing, setRefreshing] = useState<Provider | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<Partial<Record<Provider, string>>>({});

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
    api<Record<Provider, ModelOption[]>>(`/workspaces/${wsId}/models`)
      .then((m) => !cancelled && setModels(m))
      .catch(() => {
        /* best-effort — section just shows "refresh to fetch" */
      });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  async function refreshModels(provider: Provider) {
    if (!wsId) return;
    setRefreshing(provider);
    setRefreshMsg((m) => ({ ...m, [provider]: '' }));
    setError(null);
    try {
      const list = await api<ModelOption[]>(
        `/workspaces/${wsId}/keys/${provider}/models`,
        { method: 'POST' },
      );
      setModels((m) => ({ ...m, [provider]: list }));
      setRefreshMsg((m) => ({ ...m, [provider]: `Updated · ${list.length} models` }));
    } catch (err) {
      setRefreshMsg((m) => ({
        ...m,
        [provider]: err instanceof Error ? err.message : 'Could not fetch models',
      }));
    } finally {
      setRefreshing(null);
    }
  }

  async function save(provider: Provider) {
    const key = (drafts[provider] ?? '').trim();
    if (!wsId || !key || key === MASKED_KEY_VALUE) return;
    setError(null);
    try {
      const info = await api<ApiKeyInfo>(`/workspaces/${wsId}/keys/${provider}`, {
        method: 'PUT',
        body: JSON.stringify({ key }),
      });
      setKeys((k) => ({ ...k, [provider]: info }));
      setDrafts((d) => ({ ...d, [provider]: '' }));
      setEditingKeys((d) => ({ ...d, [provider]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save key');
    }
  }

  async function confirmSave() {
    if (!toSave) return;
    setSaving(true);
    try {
      await save(toSave);
      setToSave(null);
    } finally {
      setSaving(false);
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
    setDrafts((d) => ({ ...d, [provider]: '' }));
    setEditingKeys((d) => ({ ...d, [provider]: false }));
  }

  function startKeyEdit(provider: Provider, existing?: ApiKeyInfo) {
    setEditingKeys((d) => ({ ...d, [provider]: true }));
    if (existing) {
      setDrafts((d) => ({ ...d, [provider]: d[provider] || MASKED_KEY_VALUE }));
    }
  }

  function cancelKeyEdit(provider: Provider) {
    setDrafts((d) => ({ ...d, [provider]: '' }));
    setEditingKeys((d) => ({ ...d, [provider]: false }));
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

  async function submitPassword() {
    setPwMsg(null);
    if (pw.next.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Password updated. Your other devices were signed out.' });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password' });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="settings">
      {error && <p className="error">{error}</p>}

      {/* ===== Preferences (language + appearance) ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>{t('settings.preferences')}</h2>
          <p>{t('settings.preferencesHint')}</p>
        </div>
        <div className="pref-rows">
          <div className="pref-row">
            <div className="pref-row-label">{t('settings.language')}</div>
            <LanguageToggleButton />
          </div>
          <div className="pref-row">
            <div className="pref-row-label">{t('settings.appearance')}</div>
            <ThemeToggleButton />
          </div>
        </div>
      </section>

      {/* ===== Section: Provider keys ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>{t('settings.providerKeys')}</h2>
          <p>
            Bring-your-own keys, encrypted at rest per workspace. Each pipeline step unlocks once its provider key is set.
            {!canManage && ' You need Owner or key-management permission to change these.'}
          </p>
        </div>

        {loading ? (
          <p className="empty">Loading keys…</p>
        ) : (
          <div className="list">
            {PROVIDERS.map((p) => {
              const existing = keys[p.id];
              const draft = drafts[p.id] ?? '';
              const isEditing = !!editingKeys[p.id] || draft.length > 0;
              const canSaveDraft = !!draft.trim() && draft !== MASKED_KEY_VALUE;
              return (
                <div className="key-row" key={p.id}>
                  <div className="key-row-info">
                    <div className="title">
                      {p.label}
                      <span className="key-set">
                        <span className={`key-dot ${existing ? 'on' : ''}`} />
                        {existing ? `Key set ···· ${existing.last4}` : t('settings.notSet')}
                      </span>
                    </div>
                    <div className="sub">
                      {p.hint}
                      {!existing && p.keyUrl && (
                        <>
                          {' · '}
                          <a className="key-getlink" href={p.keyUrl} target="_blank" rel="noreferrer">
                            {t('settings.getKey')} ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="key-row-form">
                      {isEditing ? (
                        <input
                          className="text-input key-input"
                          type="password"
                          name={`lyra-key-${p.id}-draft`}
                          autoComplete="new-password"
                          data-1p-ignore="true"
                          data-lpignore="true"
                          data-form-type="other"
                          placeholder={existing ? 'replace key' : 'Paste key'}
                          value={draft}
                          onFocus={(e) => {
                            if (existing && draft === MASKED_KEY_VALUE) e.currentTarget.select();
                          }}
                          onChange={(e) => {
                            setEditingKeys((d) => ({ ...d, [p.id]: true }));
                            setDrafts((d) => ({ ...d, [p.id]: e.target.value }));
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-input key-input key-input-trigger"
                          onClick={() => startKeyEdit(p.id, existing)}
                        >
                          {existing ? MASKED_KEY_VALUE : 'Paste key'}
                        </button>
                      )}
                      {isEditing && (
                        <div className="key-row-btns">
                          <button
                            type="button"
                            className="icon-btn-primary"
                            title="Save key"
                            disabled={!canSaveDraft}
                            onClick={() => setToSave(p.id)}
                          >
                            <CheckIcon width={16} height={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn-danger"
                            title="Cancel editing"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              cancelKeyEdit(p.id);
                            }}
                            onClick={() => cancelKeyEdit(p.id)}
                          >
                            <XIcon width={16} height={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== Section 2: Models, grouped by provider ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>Models</h2>
          <p>
            Models available in the prompt playground and pipeline steps. Refresh to fetch the current list
            from each provider — no code change needed.
          </p>
        </div>

        <div className="model-groups">
          {LISTABLE.map((p) => {
            const existing = keys[p];
            const list = models[p] ?? [];
            const msg = refreshMsg[p];
            return (
              <div className="model-group" key={p}>
                <div className="model-group-head">
                  <span className="mg-title">{LABEL[p]}</span>
                  <span className="mg-count">{list.length} models</span>
                  {canManage && existing && (
                    <button
                      className="icon-btn mg-refresh"
                      title="Fetch latest models from provider"
                      disabled={refreshing === p}
                      onClick={() => void refreshModels(p)}
                    >
                      <RefreshIcon width={16} height={16} className={refreshing === p ? 'icon spin' : 'icon'} />
                    </button>
                  )}
                </div>

                {!existing ? (
                  <p className="mg-hint">Add the {LABEL[p]} key above to fetch its models.</p>
                ) : list.length === 0 ? (
                  <p className="mg-hint">No models yet — refresh to fetch.</p>
                ) : (
                  <div className="mg-models">
                    {list.map((m) => (
                      <span className="model-tag" key={m.id} title={m.id}>{m.label}</span>
                    ))}
                  </div>
                )}

                {msg && <p className="mg-msg">{msg}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Section 3: Password ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>Password</h2>
          <p>Change your password. Updating it signs out your other devices.</p>
        </div>
        <form className="pw-form" onSubmit={(e) => { e.preventDefault(); void submitPassword(); }}>
          <input
            className="text-input"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
          />
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
          />
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={pw.confirm}
            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
          />
          <button
            className="btn-primary"
            type="submit"
            style={{ width: 'auto', alignSelf: 'flex-start' }}
            disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
          >
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
          {pwMsg && <p className={pwMsg.ok ? 'pw-ok' : 'error'}>{pwMsg.text}</p>}
        </form>
      </section>

      <ConfirmDialog
        open={!!toSave}
        title="Save provider key?"
        message={
          <>
            Save this <strong>{toSave ? LABEL[toSave] : ''}</strong> key for this workspace? It will replace the current
            key and affect future pipeline runs that use this provider.
          </>
        }
        confirmLabel="Save key"
        busy={saving}
        onConfirm={() => void confirmSave()}
        onCancel={() => setToSave(null)}
      />

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
