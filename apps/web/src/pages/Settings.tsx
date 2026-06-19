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
const PROVIDERS: { id: Provider; label: string; hintKey: string; keyUrl?: string }[] = [
  { id: Provider.OpenAI, label: 'OpenAI', hintKey: 'openai', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: Provider.Anthropic, label: 'Anthropic', hintKey: 'anthropic', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: Provider.DeepSeek, label: 'DeepSeek', hintKey: 'deepseek', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: Provider.Image, label: 'Image', hintKey: 'image', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: Provider.Video, label: 'Video', hintKey: 'video' },
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
      setRefreshMsg((m) => ({ ...m, [provider]: t('settings.modelsUpdated', { count: list.length }) }));
    } catch (err) {
      setRefreshMsg((m) => ({
        ...m,
        [provider]: err instanceof Error ? err.message : t('settings.modelsFetchFailed'),
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
      setError(err instanceof Error ? err.message : t('settings.saveKeyFailed'));
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
      setPwMsg({ ok: false, text: t('settings.passwordTooShort') });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: t('settings.passwordsNoMatch') });
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ ok: true, text: t('settings.passwordUpdated') });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : t('settings.passwordChangeFailed') });
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
            {t('settings.providerKeysLongHint')}
            {!canManage && t('settings.keyManagePermissionHint')}
          </p>
        </div>

        {loading ? (
          <p className="empty">{t('settings.loadingKeys')}</p>
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
                        {existing ? t('settings.keySet', { last4: existing.last4 }) : t('settings.notSet')}
                      </span>
                    </div>
                    <div className="sub">
                      {t(`settings.providerHints.${p.hintKey}`)}
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
                          placeholder={existing ? t('settings.replaceKey') : t('settings.pasteKey')}
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
                          {existing ? MASKED_KEY_VALUE : t('settings.pasteKey')}
                        </button>
                      )}
                      {isEditing && (
                        <div className="key-row-btns">
                          <button
                            type="button"
                            className="icon-btn-primary"
                            title={t('settings.saveKeyTitle')}
                            disabled={!canSaveDraft}
                            onClick={() => setToSave(p.id)}
                          >
                            <CheckIcon width={16} height={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn-danger"
                            title={t('settings.cancelEditing')}
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
          <h2>{t('settings.models')}</h2>
          <p>{t('settings.modelsHint')}</p>
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
                  <span className="mg-count">{t('settings.modelsCount', { count: list.length })}</span>
                  {canManage && existing && (
                    <button
                      className="icon-btn mg-refresh"
                      title={t('settings.fetchLatestModels')}
                      disabled={refreshing === p}
                      onClick={() => void refreshModels(p)}
                    >
                      <RefreshIcon width={16} height={16} className={refreshing === p ? 'icon spin' : 'icon'} />
                    </button>
                  )}
                </div>

                {!existing ? (
                  <p className="mg-hint">{t('settings.addProviderKeyToFetch', { provider: LABEL[p] })}</p>
                ) : list.length === 0 ? (
                  <p className="mg-hint">{t('settings.noModelsYet')}</p>
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
          <h2>{t('settings.password')}</h2>
          <p>{t('settings.passwordHint')}</p>
        </div>
        <form className="pw-form" onSubmit={(e) => { e.preventDefault(); void submitPassword(); }}>
          <input
            className="text-input"
            type="password"
            autoComplete="current-password"
            placeholder={t('settings.currentPassword')}
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
          />
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('settings.newPasswordMin')}
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
          />
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            placeholder={t('settings.confirmNewPassword')}
            value={pw.confirm}
            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
          />
          <button
            className="btn-primary"
            type="submit"
            style={{ width: 'auto', alignSelf: 'flex-start' }}
            disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
          >
            {pwBusy ? t('settings.updatingPassword') : t('settings.updatePassword')}
          </button>
          {pwMsg && <p className={pwMsg.ok ? 'pw-ok' : 'error'}>{pwMsg.text}</p>}
        </form>
      </section>

      <ConfirmDialog
        open={!!toSave}
        title={t('settings.saveProviderKeyTitle')}
        message={t('settings.saveProviderKeyMessage', { provider: toSave ? LABEL[toSave] : '' })}
        confirmLabel={t('settings.saveKeyTitle')}
        busy={saving}
        onConfirm={() => void confirmSave()}
        onCancel={() => setToSave(null)}
      />

      <ConfirmDialog
        open={!!toRemove}
        title={t('settings.removeKeyTitle')}
        message={t('settings.removeKeyMessage', { provider: toRemove ? LABEL[toRemove] : '' })}
        confirmLabel={t('settings.remove')}
        danger
        busy={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
