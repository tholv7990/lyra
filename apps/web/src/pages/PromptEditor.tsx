import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  defaultModel,
  isAllowedMedia,
  MEDIA_MAX_BYTES,
  PromptStatus,
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
import { Markdown } from '../components/Markdown';
import { CheckIcon, PencilIcon, XIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

interface FormState {
  title: string;
  content: string;
  status: PromptStatus;
  media: PromptMedia[];
  tags: string[];
  provider: Provider;
  model: string;
}
const emptyForm: FormState = {
  title: '',
  content: '',
  status: PromptStatus.Draft,
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
  // Mobile: the title shows as text in the top menu; tapping ✎ edits it in place.
  // (On desktop the title is always an editable input — CSS hides these toggles.)
  const [renaming, setRenaming] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [renaming]);

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
    try {
      if (isEdit) {
        await api<Prompt>(`/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(form), signal: ctrl.signal });
      } else {
        await api<Prompt>(`/workspaces/${wsId}/prompts`, { method: 'POST', body: JSON.stringify(form), signal: ctrl.signal });
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

  return (
    <form className="pe" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {/* Top menu: ✎ edit-name + title (left) · ✓ save (green) · ✕ cancel (red).
          On mobile this is the app-style header bar; on desktop the title is an
          always-editable input (the ✎ / read-only text are CSS-hidden there). */}
      <div className={`pe-titlerow ${renaming ? 'renaming' : ''}`}>
        <button
          type="button"
          className="pe-rename-btn"
          title={t('prompts.editName')}
          aria-label={t('prompts.editName')}
          onClick={() => setRenaming(true)}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="pe-title-text"
          onClick={() => setRenaming(true)}
        >
          {form.title.trim() || t('prompts.untitled')}
        </button>
        <input
          ref={titleRef}
          className="pe-title"
          placeholder={t('prompts.promptTitlePlaceholder')}
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onBlur={() => setRenaming(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setRenaming(false);
              titleRef.current?.blur();
            }
          }}
        />
        <div className="pe-actions">
          <button
            type="submit"
            className="icon-btn-success"
            title={isEdit ? t('prompts.saveChanges') : t('prompts.createPrompt')}
            aria-label={isEdit ? t('prompts.saveChanges') : t('prompts.createPrompt')}
            disabled={busy || !form.title.trim()}
          >
            <CheckIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="icon-btn-danger"
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
            onClick={() => navigate('/prompts')}
          >
            <XIcon />
          </button>
        </div>
      </div>

      {error && <p className="error pe-error">{error}</p>}

      {/* Label picker (left) + status toggle (right) in one row. */}
      <div className="pe-row">
        <div className="pe-field pe-tags">
          <span className="pe-field-label">{t('prompts.label')}</span>
          <div className="pe-field-control">
            <LabelPicker
              value={form.tags}
              labels={labels}
              onChange={(tags) => setForm({ ...form, tags })}
              onCreate={createLabel}
            />
          </div>
        </div>
        <div className="pe-field pe-status">
          <span className="pe-field-label">{t('prompts.status')}</span>
          <label className="pe-toggle" title={t('prompts.publicHint')}>
            <span className="pe-toggle-text">{t('prompts.publicLabel')}</span>
            <input
              type="checkbox"
              checked={form.status === PromptStatus.Public}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? PromptStatus.Public : PromptStatus.Draft })}
            />
            <span className="pe-track"><span className="pe-knob" /></span>
          </label>
        </div>
      </div>

      {/* live preview (the "answer" area) — grows and scrolls */}
      <div className="pe-preview-scroll">
        {form.content.trim() ? (
          <Markdown>{form.content}</Markdown>
        ) : (
          <div className="pe-preview-hint">
            <h3>{t('prompts.writeHeading')}</h3>
            <p>{t('prompts.writeHint')}</p>
            <p className="pe-preview-vars">
              {t('prompts.variables')}: <code>{'{product}'}</code> <code>{'{niche}'}</code> <code>{'{homepage}'}</code> <code>{'{note}'}</code>{' '}
              — {t('prompts.variablesPipeline')} <code>{'{input}'}</code> ({t('prompts.variablesPrevStep')}){' '}
              {t('prompts.variablesOr')} <code>{'{step:Name}'}</code> ({t('prompts.variablesAnyStep')}).
            </p>
          </div>
        )}
      </div>

      {/* shared composer (same component as the Try page) — blends into the page */}
      <Composer
        className="pe-composer"
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
                className="btn-primary"
                style={{ width: 'auto', marginTop: 0 }}
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
