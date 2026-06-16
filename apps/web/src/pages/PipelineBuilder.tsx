import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  defaultModel,
  Provider,
  StepMode,
  tagColor,
  type Paged,
  type Pipeline,
  type PipelineStep,
  type Prompt,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useModels } from '../lib/useModels';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { TagInput } from '../components/TagInput';

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
};
const PROVIDERS = Object.values(Provider);

function uuid() {
  return crypto.randomUUID();
}

type Draft = Omit<PipelineStep, 'id'> & { id?: string };
type Editing = { step: Draft; index: number; isNew: boolean } | null;

export function PipelineBuilder() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { catalog } = useModels(wsId);

  // First refreshed/known model for a provider (falls back to the static default).
  const catalogDefault = (p: Provider) => catalog[p]?.[0]?.id ?? defaultModel(p);
  const modelLabel = (p: Provider, m: string) =>
    catalog[p]?.find((o) => o.id === m)?.label ?? m;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id || !wsId) return;
    api<Pipeline>(`/pipelines/${id}`)
      .then((p) => {
        setPipeline(p);
        setName(p.name);
        setDescription(p.description);
        setTags(p.tags);
        setSteps(p.steps);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load pipeline'));
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?limit=200`)
      .then((r) => setPrompts(r.items))
      .catch(() => setPrompts([]));
  }, [id, wsId]);

  const canEdit = useMemo(
    () => !!user && !!pipeline && (pipeline.createdBy.id === user.id || current?.role === 'owner'),
    [user, pipeline, current],
  );

  const promptTitle = (pid: string) => prompts.find((p) => p.id === pid)?.title ?? '(prompt)';

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function openNew(index: number) {
    setEditing({
      isNew: true,
      index,
      step: {
        name: '',
        promptId: prompts[0]?.id ?? '',
        provider: Provider.Anthropic,
        model: catalogDefault(Provider.Anthropic),
        mode: StepMode.Auto,
      },
    });
  }

  function openEdit(index: number) {
    setEditing({ isNew: false, index, step: { ...steps[index] } });
  }

  function saveStep() {
    if (!editing) return;
    const s = editing.step;
    if (!s.name.trim() || !s.promptId) {
      setError('Step needs a name and a prompt.');
      return;
    }
    const finalStep: PipelineStep = {
      id: s.id ?? uuid(),
      name: s.name.trim(),
      promptId: s.promptId,
      provider: s.provider,
      model: s.model,
      mode: s.mode,
    };
    setSteps((list) => {
      if (editing.isNew) {
        const next = [...list];
        next.splice(editing.index, 0, finalStep);
        return next;
      }
      return list.map((x, i) => (i === editing.index ? finalStep : x));
    });
    setDirty(true);
    setEditing(null);
    setError(null);
  }

  function removeStep(index: number) {
    setSteps((list) => list.filter((_, i) => i !== index));
    setDirty(true);
  }

  function move(index: number, dir: -1 | 1) {
    setSteps((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setDirty(true);
  }

  // Drag-to-reorder (desktop): drop the dragged step before the target step.
  function reorder(from: number, to: number) {
    if (from === to) return;
    setSteps((list) => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, moved);
      return next;
    });
    setDirty(true);
  }

  function onDrop(target: number) {
    if (dragIndex !== null) reorder(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Pipeline>(`/pipelines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description, tags, steps }),
      });
      setPipeline(updated);
      setSteps(updated.steps);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save pipeline');
    } finally {
      setSaving(false);
    }
  }

  if (!pipeline) {
    return <p className="empty">{error ?? 'Loading…'}</p>;
  }

  const ed = editing?.step;

  return (
    <div className="pb">
      <div className="pb-top">
        <Link to="/pipelines" className="pg-back">← Pipelines</Link>
        <div className="pb-title-row">
          <input
            className="text-input pb-name"
            value={name}
            disabled={!canEdit}
            onChange={(e) => mark(setName)(e.target.value)}
            placeholder="Pipeline name"
          />
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={!canEdit || !dirty || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <input
          className="text-input pb-desc"
          value={description}
          disabled={!canEdit}
          onChange={(e) => mark(setDescription)(e.target.value)}
          placeholder="Description (optional)"
        />
        <div className="pb-tags">
          <TagInput value={tags} suggestions={[]} onChange={mark(setTags)} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {prompts.length === 0 && (
        <p className="empty">
          No prompts yet — <Link to="/prompts" style={{ color: 'var(--primary)' }}>create a prompt</Link> first to add steps.
        </p>
      )}

      <div className="flow">
        <div className="flow-cap">● Start</div>

        {steps.map((s, i) => (
          <div key={s.id}>
            <Connector onAdd={canEdit ? () => openNew(i) : undefined} />
            <div
              className={`flow-node${dragIndex === i ? ' dragging' : ''}${
                overIndex === i && dragIndex !== null && dragIndex !== i ? ' drag-over' : ''
              }`}
              style={{ '--accent': tagColor(s.name || s.promptId) } as CSSProperties}
              onDragOver={canEdit ? (e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); } : undefined}
              onDrop={canEdit ? (e) => { e.preventDefault(); onDrop(i); } : undefined}
            >
              {canEdit && (
                <div
                  className="flow-grip"
                  title="Drag to reorder"
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  aria-hidden
                >
                  ⠿
                </div>
              )}
              <div className="flow-node-main" onClick={() => canEdit && openEdit(i)}>
                <div className="flow-node-head">
                  <span className="flow-num">{i + 1}</span>
                  <span className="flow-name">{s.name}</span>
                  <span className={`mode-tag ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
                    {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
                  </span>
                </div>
                <div className="flow-node-sub">
                  {promptTitle(s.promptId)} · {PROVIDER_LABELS[s.provider]} · {modelLabel(s.provider, s.model)}
                </div>
              </div>
              {canEdit && (
                <div className="flow-node-actions">
                  <button className="icon-mini" title="Move up" onClick={() => move(i, -1)}>↑</button>
                  <button className="icon-mini" title="Move down" onClick={() => move(i, 1)}>↓</button>
                  <button className="icon-mini danger" title="Remove" onClick={() => removeStep(i)}>×</button>
                </div>
              )}
            </div>
          </div>
        ))}

        <Connector onAdd={canEdit ? () => openNew(steps.length) : undefined} />
        <div className="flow-cap end">◉ End</div>
      </div>

      {ed && (
        <div className="drawer-scrim" onClick={() => setEditing(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.isNew ? 'Add step' : 'Edit step'}</h3>

            <label className="pf-field">
              <span className="pf-label">Name</span>
              <input
                className="text-input"
                autoFocus
                value={ed.name}
                onChange={(e) => setEditing({ ...editing!, step: { ...ed, name: e.target.value } })}
              />
            </label>

            <label className="pf-field">
              <span className="pf-label">Prompt</span>
              <select
                className="text-input"
                value={ed.promptId}
                onChange={(e) => setEditing({ ...editing!, step: { ...ed, promptId: e.target.value } })}
              >
                <option value="">Select a prompt…</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label className="pf-field">
                <span className="pf-label">Provider</span>
                <select
                  className="text-input"
                  value={ed.provider}
                  onChange={(e) => {
                    const provider = e.target.value as Provider;
                    setEditing({ ...editing!, step: { ...ed, provider, model: catalogDefault(provider) } });
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span className="pf-label">Model</span>
                <select
                  className="text-input"
                  value={ed.model}
                  onChange={(e) => setEditing({ ...editing!, step: { ...ed, model: e.target.value } })}
                >
                  {(catalog[ed.provider] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pf-field">
              <span className="pf-label">Mode</span>
              <div className="seg">
                <button
                  type="button"
                  className={ed.mode === StepMode.Auto ? 'on' : ''}
                  onClick={() => setEditing({ ...editing!, step: { ...ed, mode: StepMode.Auto } })}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={ed.mode === StepMode.Gate ? 'on' : ''}
                  onClick={() => setEditing({ ...editing!, step: { ...ed, mode: StepMode.Gate } })}
                >
                  Gate
                </button>
              </div>
            </div>

            <div className="drawer-actions">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} onClick={saveStep}>
                {editing.isNew ? 'Add step' : 'Save step'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Connector({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flow-connector">
      {onAdd && (
        <button className="flow-add" onClick={onAdd} title="Add step">+</button>
      )}
    </div>
  );
}
