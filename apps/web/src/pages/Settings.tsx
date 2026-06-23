import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider, canManageKeys, type ApiKeyInfo, type ModelOption } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddKeyModal } from '../components/AddKeyModal';
import { RequestProviderModal } from '../components/RequestProviderModal';
import { ProviderCard } from '../components/ProviderCard';
import { ProviderBadge } from '../components/ProviderBadge';
import { ModalityIcon } from '../lib/promptType';
import {
  AVAILABLE_PROVIDERS,
  PROVIDER_CATALOG,
  SOON_PROVIDERS,
  type ProviderCatalogEntry,
} from '../lib/providerCatalog';
import { LanguageToggleButton, ThemeToggleButton } from '../components/PrefControls';
import { MenuPicker } from '../components/MenuPicker';
import { PostizKeySection } from '../components/PostizKeySection';
import { TavilyKeySection } from '../components/TavilyKeySection';
import { FirecrawlKeySection } from '../components/FirecrawlKeySection';
import { PlusIcon } from '../layout/icons';

export function Settings() {
  const { t } = useTranslation();
  const { user, changePassword } = useAuth();
  const { current } = useWorkspace();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys] = useState<Partial<Record<Provider, ApiKeyInfo>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Partial<Record<Provider, ModelOption[]>>>({});
  const [refreshing, setRefreshing] = useState<Provider | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<Partial<Record<Provider, string>>>({});

  // Add/replace-key modal + delete confirmation.
  const [pick, setPick] = useState('');
  const [addEntry, setAddEntry] = useState<ProviderCatalogEntry | null>(null);
  const [addReplace, setAddReplace] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<ProviderCatalogEntry | null>(null);
  const [removing, setRemoving] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requested, setRequested] = useState(false);

  const wsId = current?.id;
  const canManage =
    !!current &&
    !!user &&
    canManageKeys({ userId: user.id, role: current.role, canManageKeys: current.canManageKeys });

  const addedProviders = useMemo(
    () => AVAILABLE_PROVIDERS.filter((p) => p.provider && keys[p.provider]),
    [keys],
  );
  const addable = useMemo(
    () => AVAILABLE_PROVIDERS.filter((p) => p.provider && !keys[p.provider]),
    [keys],
  );

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    api<ApiKeyInfo[]>(`/workspaces/${wsId}/keys`)
      .then((list) => {
        if (cancelled) return;
        setKeys(Object.fromEntries(list.map((k) => [k.provider, k])) as Partial<Record<Provider, ApiKeyInfo>>);
      })
      .catch(() => !cancelled && setKeys({}))
      .finally(() => !cancelled && setLoading(false));
    api<Record<Provider, ModelOption[]>>(`/workspaces/${wsId}/models`)
      .then((m) => !cancelled && setModels(m))
      .catch(() => {
        /* best-effort — cards just show their Load button */
      });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  // Keep the dropdown pointed at a still-addable provider.
  useEffect(() => {
    if (addable.length && !addable.some((p) => p.id === pick)) setPick(addable[0].id);
  }, [addable, pick]);

  async function refreshModels(provider: Provider) {
    if (!wsId) return;
    setRefreshing(provider);
    setRefreshMsg((m) => ({ ...m, [provider]: '' }));
    try {
      const list = await api<ModelOption[]>(`/workspaces/${wsId}/keys/${provider}/models`, { method: 'POST' });
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

  function openAdd(id: string, replace = false) {
    const entry = PROVIDER_CATALOG.find((p) => p.id === id);
    if (!entry) return;
    setAddError(null);
    setAddReplace(replace);
    setAddEntry(entry);
  }

  async function saveKey(plain: string) {
    if (!wsId || !addEntry?.provider) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const info = await api<ApiKeyInfo>(`/workspaces/${wsId}/keys/${addEntry.provider}`, {
        method: 'PUT',
        body: JSON.stringify({ key: plain }),
      });
      setKeys((k) => ({ ...k, [addEntry.provider!]: info }));
      setAddEntry(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('settings.saveKeyFailed'));
    } finally {
      setAddBusy(false);
    }
  }

  async function confirmRemove() {
    if (!toRemove?.provider || !wsId) return;
    setRemoving(true);
    setError(null);
    try {
      await api(`/workspaces/${wsId}/keys/${toRemove.provider}`, { method: 'DELETE' });
      setKeys((k) => {
        const next = { ...k };
        delete next[toRemove.provider!];
        return next;
      });
      setToRemove(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.removeKeyFailed'));
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

      {/* ===== Providers (keys + models, unified) ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>{t('settings.providers')}</h2>
          <p>
            {t('settings.providersHint')}
            {!canManage && ` ${t('settings.keyManagePermissionHint')}`}
          </p>
        </div>

        {canManage && addable.length > 0 && (
          <div className="prov-add">
            <MenuPicker<string>
              value={pick}
              options={addable.map((p) => ({ value: p.id, label: p.label }))}
              onChange={(v) => setPick(v)}
              ariaLabel={t('settings.chooseProvider')}
            />
            <button type="button" className="btn-primary prov-add-btn" onClick={() => openAdd(pick)} disabled={!pick}>
              <PlusIcon width={15} height={15} />
              {t('settings.addProvider')}
            </button>
          </div>
        )}

        {loading ? (
          <p className="empty">{t('settings.loadingKeys')}</p>
        ) : addedProviders.length === 0 ? (
          <p className="prov-empty">{t('settings.noProvidersYet')}</p>
        ) : (
          <div className="prov-list">
            {addedProviders.map((p) => (
              <ProviderCard
                key={p.id}
                entry={p}
                keyInfo={keys[p.provider!]!}
                models={models[p.provider!] ?? []}
                loading={refreshing === p.provider}
                loadMsg={refreshMsg[p.provider!]}
                canManage={canManage}
                onLoad={() => void refreshModels(p.provider!)}
                onReplace={() => openAdd(p.id, true)}
                onRemove={() => setToRemove(p)}
              />
            ))}
          </div>
        )}

        {/* Roadmap — listed so users see what's coming; "Request a provider"
            captures anything not here for the admins to triage. */}
        <div className="prov-soon">
          <div className="prov-soon-top">
            <span className="prov-soon-label">{t('settings.comingSoon')}</span>
            <button type="button" className="btn-ghost prov-request-btn" onClick={() => setRequestOpen(true)}>
              <PlusIcon width={14} height={14} />
              {t('settings.requestProvider')}
            </button>
          </div>
          <div className="prov-soon-chips">
            {SOON_PROVIDERS.map((p) => (
              <span className="prov-chip" key={p.id}>
                <ProviderBadge entry={p} size={18} />
                {p.label}
                <span className="prov-chip-mods">
                  {p.modalities.map((m) => (
                    <ModalityIcon key={m} type={m} size={11} title={t(`settings.modality.${m}`)} />
                  ))}
                </span>
              </span>
            ))}
          </div>
          <p className="prov-soon-foot">{t('settings.providerFootnote')}</p>
          {requested && (
            <p className="prov-msg" role="status" aria-live="polite">
              {t('settings.requestThanks')}
            </p>
          )}
        </div>
      </section>

      {/* ===== Publishing (Postiz API key) ===== */}
      <PostizKeySection />

      {/* ===== Research (Tavily search key) ===== */}
      <TavilyKeySection />

      {/* ===== Robust fetch (Firecrawl key) ===== */}
      <FirecrawlKeySection />

      {/* ===== Password ===== */}
      <section className="set-section">
        <div className="set-section-head">
          <h2>{t('settings.password')}</h2>
          <p>{t('settings.passwordHint')}</p>
        </div>
        <form
          className="pw-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitPassword();
          }}
        >
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

      {addEntry && (
        <AddKeyModal
          entry={addEntry}
          replace={addReplace}
          busy={addBusy}
          error={addError}
          onSave={(key) => void saveKey(key)}
          onClose={() => setAddEntry(null)}
        />
      )}

      {requestOpen && (
        <RequestProviderModal
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => {
            setRequestOpen(false);
            setRequested(true);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toRemove}
        title={t('settings.removeKeyTitle')}
        message={t('settings.removeKeyMessage', { provider: toRemove?.label ?? '' })}
        confirmLabel={t('settings.remove')}
        danger
        busy={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
