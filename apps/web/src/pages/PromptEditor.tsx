import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  defaultModel,
  isAllowedMedia,
  MEDIA_MAX_BYTES,
  PromptStatus,
  PromptType,
  Provider,
  type Prompt,
  type PromptMedia,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useModels } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { LabelPicker } from '../components/LabelPicker';
import { Composer } from '../components/Composer';
import { CheckIcon } from '../layout/icons';
import { TypeSelect } from '../components/TypeSelect';
import { Toggle } from '../components/Toggle';
import { useBreadcrumb } from '../layout/breadcrumb';

interface FormState {
  title: string;
  content: string;
  status: PromptStatus;
  type: PromptType;
  media: PromptMedia[];
  tags: string[];
  provider: Provider;
  model: string;
}
const emptyForm: FormState = {
  title: '',
  content: '',
  status: PromptStatus.Draft,
  type: PromptType.Text,
  media: [],
  tags: [],
  provider: Provider.Anthropic,
  model: defaultModel(Provider.Anthropic),
};

export function PromptEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const navigate = useNavigate();
  const { catalog } = useModels(wsId);
  const { labels, createLabel } = useLabels(wsId);

  const [form, setForm] = useState<FormState>(emptyForm);
  // The last-saved snapshot — `form` is "dirty" when it differs from this.
  const baselineRef = useRef<FormState>(emptyForm);
  useBreadcrumb(isEdit ? form.title.trim() || '…' : t('prompts.newTitle'));
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  // Unsaved-changes guard: the form is dirty when it differs from the last-saved
  // snapshot. Block in-app navigation (back/breadcrumb/sidebar) with a "Save
  // changes?" dialog, and warn the browser on tab close/refresh. `leavingRef`
  // lets a successful save navigate away without re-prompting.
  const dirty =
    !loading && !denied && JSON.stringify(form) !== JSON.stringify(baselineRef.current);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const leavingRef = useRef(false);
  const blocker = useBlocker(
    useCallback(() => dirtyRef.current && !leavingRef.current, []),
  );
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Prompt>(`/prompts/${id}`)
      .then((p) => {
        if (user && p.createdBy.id !== user.id) {
          setDenied(true);
          return;
        }
        const provider = p.provider ?? Provider.Anthropic;
        const loaded: FormState = {
          title: p.title,
          content: p.content,
          status: p.status,
          type: p.type,
          media: [...p.media],
          tags: [...p.tags],
          provider,
          model: p.model ?? defaultModel(provider),
        };
        setForm(loaded);
        baselineRef.current = loaded;
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('prompts.errLoad')))
      .finally(() => setLoading(false));
  }, [id, user]);

  async function uploadFiles(files: FileList | null) {
    if (!files || !wsId) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!isAllowedMedia(file.type, file.name)) { setError(t('prompts.errFileType', { name: file.name })); continue; }
      if (file.size > MEDIA_MAX_BYTES) { setError(t('prompts.errFileSize', { name: file.name })); continue; }
      setUploading((u) => u + 1);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const media = await api<PromptMedia>(`/workspaces/${wsId}/files`, { method: 'POST', body: fd });
        setForm((f) => ({ ...f, media: [...f.media, media] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('prompts.errUpload', { name: file.name }));
      } finally {
        setUploading((u) => u - 1);
      }
    }
  }

  const saveAbortRef = useRef<AbortController | null>(null);
  // Write to the server and mark the form clean. Returns whether it succeeded;
  // does NOT navigate (callers decide).
  async function persist(): Promise<boolean> {
    if (!wsId || !form.title.trim() || busy) return false;
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    saveAbortRef.current = ctrl;
    const payload = JSON.stringify(form);
    try {
      if (isEdit) {
        await api<Prompt>(`/prompts/${id}`, { method: 'PATCH', body: payload, signal: ctrl.signal });
      } else {
        await api<Prompt>(`/workspaces/${wsId}/prompts`, { method: 'POST', body: payload, signal: ctrl.signal });
      }
      baselineRef.current = form; // now clean — won't trip the leave guard
      return true;
    } catch (err) {
      // Abort (user pressed stop) is not an error — just stay on the page.
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : t('prompts.errSave'));
      }
      return false;
    } finally {
      setBusy(false);
      saveAbortRef.current = null;
    }
  }
  // ✓ / ⌘+Enter: save, then leave for the list.
  async function save() {
    const ok = await persist();
    if (ok) {
      leavingRef.current = true;
      navigate('/prompts');
    }
  }
  function stopSave() {
    saveAbortRef.current?.abort();
  }

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (denied) {
    return <p className="empty">{t('prompts.onlyEditOwn')}</p>;
  }

  const detectedVars = [...new Set(form.content.match(/\{[^{}]+\}/g) ?? [])];
  const isPublic = form.status === PromptStatus.Public;

  return (
    <form className="pe2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {/* Header: title (left) · Cancel + Save prompt (right). The "Prompts / …"
          breadcrumb is in the app top bar (useBreadcrumb). */}
      <div className="pe2-head">
        <input
          className="pe2-title"
          placeholder={t('prompts.promptTitlePlaceholder')}
          autoFocus={!isEdit}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="pe2-actions">
          <button type="button" className="btn-ghost btn-inline btn-sm" onClick={() => navigate('/prompts')}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary btn-inline btn-sm" disabled={busy || !form.title.trim()}>
            <CheckIcon width={14} height={14} />
            {busy ? t('common.saving') : t('prompts.savePrompt')}
          </button>
        </div>
      </div>

      {error && <p className="error pe-error">{error}</p>}

      {/* Type (metadata) + Public/Draft visibility toggle */}
      <div className="pe2-meta">
        <div className="pe2-field">
          <span className="pe2-mini-label" id="pe-type-label">{t('prompts.typeLabel')}</span>
          <TypeSelect value={form.type} onChange={(type) => setForm({ ...form, type })} labelledBy="pe-type-label" />
        </div>
        <Toggle
          checked={isPublic}
          onChange={(v) => setForm({ ...form, status: v ? PromptStatus.Public : PromptStatus.Draft })}
          label={isPublic ? t('prompts.publicLabel') : t('prompts.statusDraft')}
          labelLeft
          title={t('prompts.publicHint')}
        />
      </div>

      {/* Labels */}
      <div className="pe2-labels">
        <span className="pe2-mini-label">{t('prompts.labelsPlural')}</span>
        <LabelPicker
          value={form.tags}
          labels={labels}
          onChange={(tags) => setForm({ ...form, tags })}
          onCreate={createLabel}
        />
      </div>

      {/* Write-your-prompt heading + variables hint */}
      <div className="pe2-write">
        <h3>{t('prompts.writeHeading')}</h3>
        <p>
          {t('prompts.writeHint')}{' '}
          <code>{'{product}'}</code> <code>{'{niche}'}</code> <code>{'{homepage}'}</code> — <code>{'{input}'}</code> / <code>{'{step:Name}'}</code>
        </p>
      </div>

      {/* The composer is the prompt-content editor (textarea + media + model + send). */}
      <Composer
        className="pe2-composer"
        value={form.content}
        onChange={(v) => setForm((f) => ({ ...f, content: v }))}
        onSubmit={() => void save()}
        placeholder={t('prompts.addPrompt')}
        media={form.media}
        onRemoveMedia={(idx) => setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }))}
        uploading={uploading}
        onFiles={(files) => void uploadFiles(files)}
        catalog={catalog}
        provider={form.provider}
        model={form.model}
        onModelChange={(provider, model) => setForm((f) => ({ ...f, provider, model }))}
        busy={busy}
        onStop={stopSave}
        canSubmit={!!form.title.trim()}
        trailing={
          <span className="pe-counter">
            <kbd className="pe-kbd">⌘/Ctrl+↵</kbd> {t('prompts.saveShortcut')} · {t('prompts.charCount', { chars: form.content.length.toLocaleString() })}
          </span>
        }
      />

      {/* Detected variables */}
      {detectedVars.length > 0 && (
        <div className="pe2-vars">
          <span className="pe2-mini-label">{t('prompts.variablesDetected')}</span>
          {detectedVars.map((v) => (
            <span key={v} className="pe2-var">{v}</span>
          ))}
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div className="dialog-scrim" onClick={() => blocker.reset?.()}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{t('prompts.unsavedTitle')}</h3>
            <p>{t('prompts.unsavedBody')}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => blocker.proceed?.()}
                disabled={busy}
              >
                {t('prompts.discardLeave')}
              </button>
              <button
                type="button"
                className="btn-primary btn-inline"
                disabled={busy || !form.title.trim()}
                onClick={async () => {
                  const ok = await persist();
                  if (ok) blocker.proceed?.();
                }}
              >
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
