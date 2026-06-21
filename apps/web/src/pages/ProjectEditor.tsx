import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  labelColor,
  ProjectShare,
  ProjectStatus,
  type Channel,
  type MemberView,
  type Project,
  type ProjectVariable,
} from '@lyra/shared';
import { api } from '../lib/api';
import { channelsApi } from '../lib/channels';
import { platformColor, platformGlyph } from '../lib/platform';
import { initials } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { EditorShell } from '../components/EditorShell';
import { CheckIcon, PlusIcon, XIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';
import './projecteditor.css';

interface Form {
  name: string;
  description: string;
  variables: ProjectVariable[];
  status: ProjectStatus;
  shared: ProjectShare;
  sharedWith: string[]; // member userIds
  channels: string[]; // connected-channel ids from the Connections pool
}

const empty: Form = {
  name: '',
  description: '',
  variables: [],
  status: ProjectStatus.Draft,
  shared: ProjectShare.All,
  sharedWith: [],
  channels: [],
};

const QUICK_KEYS = ['product', 'niche', 'homepage'];

export function ProjectEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();

  const [form, setForm] = useState<Form>(empty);
  useBreadcrumb(isEdit ? form.name.trim() || '…' : t('projects.breadcrumbNew'));
  const [members, setMembers] = useState<MemberView[]>([]);
  const [pool, setPool] = useState<Channel[]>([]); // connected channels (workspace pool)
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const isPublic = form.status === ProjectStatus.Public;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Project>(`/projects/${id}`)
      .then((p) => {
        const canEdit =
          !!user && !!current &&
          canEditProject(
            { createdBy: p.createdBy.id },
            { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
          );
        if (!canEdit) {
          setDenied(true);
          return;
        }
        setForm({
          name: p.name,
          description: p.description ?? '',
          variables: p.variables ?? [],
          status: p.status,
          shared: p.shared ?? ProjectShare.All,
          sharedWith: (p.sharedWith ?? []).map((u) => u.id),
          channels: p.channels ?? [],
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('projects.loadFailed')))
      .finally(() => setLoading(false));
  }, [id, user, current]);

  // Members are only needed for the "specific people" picker.
  useEffect(() => {
    if (!wsId) return;
    api<MemberView[]>(`/workspaces/${wsId}/members`).then(setMembers).catch(() => setMembers([]));
  }, [wsId]);

  // The connected-channel pool (workspace Connections) to select this project's channels from.
  useEffect(() => {
    if (!wsId) return;
    channelsApi.list(wsId).then(setPool).catch(() => setPool([]));
  }, [wsId]);

  const toggleChannel = (cid: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(cid) ? f.channels.filter((x) => x !== cid) : [...f.channels, cid],
    }));

  const cancelTo = isEdit ? `/projects/${id}` : '/projects';

  const setVar = (i: number, patch: Partial<ProjectVariable>) =>
    setForm((f) => ({ ...f, variables: f.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  const removeVar = (i: number) =>
    setForm((f) => ({ ...f, variables: f.variables.filter((_, idx) => idx !== i) }));
  const addVar = (key = '') =>
    setForm((f) => ({ ...f, variables: [...f.variables, { key, value: '' }] }));
  const toggleMember = (uid: string) =>
    setForm((f) => ({
      ...f,
      sharedWith: f.sharedWith.includes(uid) ? f.sharedWith.filter((x) => x !== uid) : [...f.sharedWith, uid],
    }));

  async function save() {
    if (!wsId || !form.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const variables = form.variables
      .map((v) => ({ key: v.key.trim(), value: v.value }))
      .filter((v) => v.key);
    const payload = {
      name: form.name.trim(),
      description: form.description,
      variables,
      status: form.status,
      // Keep only ids that still exist in the pool (a channel may have been disconnected).
      channels: pool.length ? form.channels.filter((c) => pool.some((p) => p.id === c)) : form.channels,
      // Visibility only matters for a public project; a draft is creator-only.
      ...(isPublic
        ? {
            shared: form.shared,
            sharedWith: form.shared === ProjectShare.People ? form.sharedWith : [],
          }
        : {}),
    };
    try {
      if (isEdit) {
        await api<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        navigate(`/projects/${id}`);
      } else {
        const created = await api<Project>(`/workspaces/${wsId}/projects`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        navigate(`/projects/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setBusy(false);
    }
  }

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (denied) return <p className="empty">{t('projects.editDenied')}</p>;

  return (
    <EditorShell
      crumb={{ label: t('nav.projects'), to: '/projects' }}
      onClose={() => navigate(cancelTo)}
      title={
        <input
          className="eshell-name"
          placeholder={t('projects.namePlaceholder')}
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
      }
      actions={
        <button
          type="button"
          className="icon-btn-success"
          title={busy ? t('common.saving') : isEdit ? t('projects.saveChanges') : t('projects.saveProject')}
          aria-label={isEdit ? t('projects.saveChanges') : t('projects.saveProject')}
          disabled={busy || !form.name.trim()}
          onClick={() => void save()}
        >
          <CheckIcon width={16} height={16} />
        </button>
      }
    >
      <div className="pe-edit">
        {error && <p className="error">{error}</p>}

        <p className="pe-help">
          {t('projects.titleHelpPre')}<code>{'{key}'}</code>{t('projects.titleHelpPost')}
        </p>

        {/* Description */}
        <section className="pe-section">
          <div className="pe-label">{t('projects.descriptionLabel')}</div>
          <div className="pe-sub">{t('projects.descriptionHelp')}</div>
          <textarea
            className="pe-textarea"
            placeholder={t('projects.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </section>

        {/* Variables */}
        <section className="pe-section">
          <div className="pe-label">{t('projects.variablesLabel')}</div>
          <div className="pe-sub">
            {t('projects.variablesHelpPre')} <code>{'{key}'}</code> {t('projects.variablesHelpPost')}
          </div>

          {form.variables.length > 0 ? (
            <div className="pe-vars">
              {form.variables.map((v, i) => (
                <div key={i} className="pe-var-row">
                  <span className="pe-key-wrap">
                    <span className="pe-brace l">{'{'}</span>
                    <input
                      className="pe-var-key"
                      placeholder={t('projects.varKeyPlaceholder')}
                      value={v.key}
                      onChange={(e) => setVar(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                    />
                    <span className="pe-brace r">{'}'}</span>
                  </span>
                  <span className="pe-eq">=</span>
                  <input
                    className="pe-var-val"
                    placeholder={t('projects.varValuePlaceholder')}
                    value={v.value}
                    onChange={(e) => setVar(i, { value: e.target.value })}
                  />
                  <button type="button" className="pe-var-del" title={t('projects.removeVariable')} aria-label={t('projects.removeVariable')} onClick={() => removeVar(i)}>
                    <XIcon width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="pe-quick">
              {t('projects.quickAddLabel')}{' '}
              {QUICK_KEYS.map((k) => (
                <button key={k} type="button" className="pe-quick-chip" onClick={() => addVar(k)}>{k}</button>
              ))}
            </div>
          )}

          <button type="button" className="pe-add" onClick={() => addVar()}>
            <PlusIcon width={14} height={14} />
            {t('projects.addVariable').replace('+ ', '')}
          </button>
        </section>

        {/* Channels — which connected channels this project publishes to */}
        <section className="pe-section">
          <div className="pe-label">{t('projects.channelsLabel')}</div>
          <div className="pe-sub">{t('projects.channelsHelp')}</div>
          {pool.length === 0 ? (
            <div className="pe-quick">
              {t('projects.noChannels')}{' '}
              <button type="button" className="pe-quick-chip" onClick={() => navigate('/connections')}>
                {t('projects.manageChannels')}
              </button>
            </div>
          ) : (
            <div className="pe-members-list">
              {pool.map((c) => {
                const selected = form.channels.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`pe-member${selected ? ' selected' : ''}`}
                    onClick={() => toggleChannel(c.id)}
                  >
                    <span className="pe-member-av" style={{ background: platformColor(c.platform) }}>{platformGlyph(c.platform)}</span>
                    <span className="pe-member-id">
                      <span className="pe-member-name">{c.displayName}</span>
                      <span className="pe-member-role">{c.platform}</span>
                    </span>
                    <span className="pe-member-check">{selected && <CheckIcon width={12} height={12} />}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Status toggle */}
        <section className="pe-section">
          <div className="pe-status-row">
            <div>
              <div className="pe-label">{t('projects.status')}</div>
              <div className="pe-sub" style={{ marginBottom: 0 }}>
                {isPublic ? t('projects.statusHelpPublic') : t('projects.statusHelpDraft')}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={`pe-toggle${isPublic ? ' on' : ''}`}
              onClick={() => setForm({ ...form, status: isPublic ? ProjectStatus.Draft : ProjectStatus.Public })}
            >
              <span className="pe-toggle-label">{isPublic ? t('projects.statusPublic') : t('projects.statusDraft')}</span>
              <span className="pe-toggle-track"><span className="pe-toggle-knob" /></span>
            </button>
          </div>
        </section>

        {/* Visibility — public only */}
        {isPublic && (
          <section className="pe-vis">
            <div className="pe-label">{t('projects.visibilityLabel')}</div>
            <div className="pe-sub">{t('projects.visibilityHelp')}</div>
            <div className="pe-vis-cards">
              <button
                type="button"
                className={`pe-vis-card${form.shared === ProjectShare.All ? ' active' : ''}`}
                onClick={() => setForm({ ...form, shared: ProjectShare.All })}
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="8" r="5.4" /><path d="M2.6 8h10.8M8 2.6c1.5 1.6 1.5 9.2 0 10.8M8 2.6C6.5 4.2 6.5 11.8 8 13.4" /></svg>
                <span>{t('projects.reachAll')}</span>
              </button>
              <button
                type="button"
                className={`pe-vis-card${form.shared === ProjectShare.People ? ' active' : ''}`}
                onClick={() => setForm({ ...form, shared: ProjectShare.People })}
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="5.4" r="2.4" /><path d="M3.4 12.6a4.6 4.6 0 0 1 9.2 0" /></svg>
                <span>{t('projects.reachPeople')}</span>
              </button>
            </div>
            {form.shared === ProjectShare.People && (
              <div className="pe-members">
                <div className="pe-members-help">{t('projects.peopleHelp', { count: form.sharedWith.length })}</div>
                <div className="pe-members-list">
                  {members
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => {
                      const selected = form.sharedWith.includes(m.userId);
                      return (
                        <button
                          key={m.membershipId}
                          type="button"
                          className={`pe-member${selected ? ' selected' : ''}`}
                          onClick={() => toggleMember(m.userId)}
                        >
                          <span className="pe-member-av" style={{ background: labelColor(m.name, []) }}>{initials(m.name)}</span>
                          <span className="pe-member-id">
                            <span className="pe-member-name">{m.name}</span>
                            <span className="pe-member-role">{m.role}</span>
                          </span>
                          <span className="pe-member-check">{selected && <CheckIcon width={12} height={12} />}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </EditorShell>
  );
}
