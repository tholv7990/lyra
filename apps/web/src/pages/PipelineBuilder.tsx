import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  defaultModel,
  labelColor,
  Provider,
  PromptStatus,
  StepMode,
  tagColor,
  type ApiKeyInfo,
  type Paged,
  type Pipeline,
  type PipelineStep,
  type Prompt,
  type Run,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useModels } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useRunActions } from '../lib/useRunActions';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { LabelPicker } from '../components/LabelPicker';
import { EditorShell } from '../components/EditorShell';
import { RunFlow } from '../components/RunFlow';
import { FlowPagerControls, useFlowPager } from '../components/FlowPager';
import { PromptPicker } from '../components/PromptPicker';
import { PromptDetails } from '../components/PromptDetails';
import { EditorActions } from '../components/EditorActions';
import { EyeIcon } from '../layout/icons';
import { useBreadcrumb } from '../layout/breadcrumb';

const RUN_STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  awaiting_gate: 'Awaiting approval',
  done: 'Done',
  error: 'Error',
};

const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
};

function uuid() {
  return crypto.randomUUID();
}

type Draft = Omit<PipelineStep, 'id'> & { id?: string };
type Editing = { step: Draft; index: number; isNew: boolean } | null;

export function PipelineBuilder() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { catalog } = useModels(wsId);
  const { labels, createLabel } = useLabels(wsId);

  // First refreshed/known model for a provider (falls back to the static default).
  const catalogDefault = (p: Provider) => catalog[p]?.[0]?.id ?? defaultModel(p);
  const modelLabel = (p: Provider, m: string) =>
    catalog[p]?.find((o) => o.id === m)?.label ?? m;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [name, setName] = useState('');
  useBreadcrumb(isNew ? name.trim() || 'New' : pipeline?.name ?? '…');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Test-from-builder (no project): run the sequence; {note} fills from the
  // pipeline note. Project-context runs live on the project page.
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<Run | null>(null);
  const [runMode, setRunMode] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null); // full-prompt viewer
  const runActions = useRunActions(run, setRun);
  const pager = useFlowPager(steps.length); // mobile one-step pager (build mode)
  const dragFrom = useRef<number | null>(null);
  const dragTo = useRef<number | null>(null);

  useEffect(() => {
    if (!wsId) return;
    if (id) {
      api<Pipeline>(`/pipelines/${id}`)
        .then((p) => {
          setPipeline(p);
          setName(p.name);
          setDescription(p.description);
          setTags(p.tags);
          setSteps(p.steps);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load pipeline'));
    }
    api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?limit=200`)
      .then((r) => setPrompts(r.items))
      .catch(() => setPrompts([]));
    api<ApiKeyInfo[]>(`/workspaces/${wsId}/keys`)
      .then((ks) => setKeysSet(new Set(ks.map((k) => k.provider))))
      .catch(() => setKeysSet(new Set()));
  }, [id, wsId]);

  const canEdit = useMemo(
    () =>
      isNew ||
      (!!user && !!pipeline && (pipeline.createdBy.id === user.id || current?.role === 'owner')),
    [isNew, user, pipeline, current],
  );

  // Steps bind a PUBLIC library prompt (a draft wouldn't be visible to other
  // members running the pipeline). The picker only offers these.
  const pickablePrompts = prompts.filter((p) => p.status === PromptStatus.Public);

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
        promptId: '', // chosen via the picker (which also sets name/provider/model)
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
    if (!s.promptId) {
      setError('Pick a prompt for this step.');
      return;
    }
    // Name/provider/model come from the chosen prompt (set on pick).
    const p = prompts.find((x) => x.id === s.promptId);
    const finalStep: PipelineStep = {
      id: s.id ?? uuid(),
      name: (s.name || p?.title || 'Step').trim(),
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

  function toggleMode(index: number) {
    setSteps((list) =>
      list.map((x, i) =>
        i === index ? { ...x, mode: x.mode === StepMode.Gate ? StepMode.Auto : StepMode.Gate } : x,
      ),
    );
    setDirty(true);
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

  // Drag-to-reorder: drop the dragged step before the target step.
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

  // Pointer-based drag — works with mouse AND touch (native HTML5 DnD doesn't
  // fire on touchscreens). Grab the grip, drag over another step, release to drop.
  function startDrag(e: ReactPointerEvent, index: number) {
    if (!canEdit) return;
    e.preventDefault();
    dragFrom.current = index;
    dragTo.current = index;
    setDragIndex(index);
    setOverIndex(index);

    const move = (ev: PointerEvent) => {
      ev.preventDefault(); // stop the page scrolling under the finger
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const node = el?.closest('[data-step-index]') as HTMLElement | null;
      if (!node) return;
      const idx = Number(node.dataset.stepIndex);
      if (!Number.isNaN(idx) && idx !== dragTo.current) {
        dragTo.current = idx;
        setOverIndex(idx);
      }
    };
    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      const from = dragFrom.current;
      const to = dragTo.current;
      dragFrom.current = null;
      dragTo.current = null;
      setDragIndex(null);
      setOverIndex(null);
      if (from !== null && to !== null) reorder(from, to);
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }

  async function save() {
    if (saving) return;
    // New pipeline: create it (with whatever steps were added), then switch to
    // edit mode. The builder is the single create + edit surface.
    if (isNew) {
      if (!wsId || !name.trim()) return;
      setSaving(true);
      setError(null);
      try {
        const created = await api<Pipeline>(`/workspaces/${wsId}/pipelines`, {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), description, tags, steps }),
        });
        setPipeline(created);
        setName(created.name);
        setDescription(created.description);
        setTags(created.tags);
        setSteps(created.steps);
        setDirty(false);
        navigate(`/pipelines/${created.id}`, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create pipeline');
      } finally {
        setSaving(false);
      }
      return;
    }
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

  // Test-run this pipeline with no project (typed/blank context), then light up
  // the same flow. Auto-saves unsaved edits first so the test reflects them.
  async function startTest() {
    if (isNew || !id || !wsId || steps.length === 0 || creatingRun) return;
    setCreatingRun(true);
    setError(null);
    try {
      if (dirty) {
        const updated = await api<Pipeline>(`/pipelines/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, description, tags, steps }),
        });
        setPipeline(updated);
        setSteps(updated.steps);
        setDirty(false);
      }
      const created = await api<Run>(`/workspaces/${wsId}/pipelines/${id}/test-runs`, {
        method: 'POST',
      });
      setRun(created);
      setRunMode(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start test');
    } finally {
      setCreatingRun(false);
    }
  }

  if (!isNew && !pipeline) {
    return <p className="empty">{error ?? 'Loading…'}</p>;
  }

  const ed = editing?.step;

  // One editable step node — reused by the full flow (desktop) and the pager
  // (mobile). Shows the bound prompt's name, snippet, tags, creator + an eye to
  // open the full prompt.
  const renderNode = (s: PipelineStep, i: number) => {
    const p = prompts.find((x) => x.id === s.promptId);
    return (
      <div
        data-step-index={i}
        className={`flow-node${dragIndex === i ? ' dragging' : ''}${
          overIndex === i && dragIndex !== null && dragIndex !== i ? ' drag-over' : ''
        }`}
        style={{ '--accent': tagColor(s.name || s.promptId) } as CSSProperties}
      >
        {canEdit && (
          <div className="flow-grip" title="Drag to reorder" onPointerDown={(e) => startDrag(e, i)} aria-hidden>
            ⠿
          </div>
        )}
        <div className="flow-node-main" onClick={() => canEdit && openEdit(i)}>
          <div className="flow-node-head">
            <span className="flow-num">{i + 1}</span>
            <span className="flow-name">{s.name}</span>
            {canEdit ? (
              <button
                type="button"
                className={`mode-tag mode-toggle ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}
                title="Toggle gate / auto"
                onClick={(e) => { e.stopPropagation(); toggleMode(i); }}
              >
                {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
              </button>
            ) : (
              <span className={`mode-tag ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
                {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
              </span>
            )}
            {p && (
              <span
                className="flow-eye"
                role="button"
                tabIndex={0}
                title="View full prompt"
                onClick={(e) => { e.stopPropagation(); setDetailPrompt(p); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDetailPrompt(p); } }}
              >
                <EyeIcon width={15} height={15} />
              </span>
            )}
          </div>
          {p?.content?.trim() && <div className="flow-node-snip">{p.content}</div>}
          <div className="flow-node-sub">
            {PROVIDER_LABELS[s.provider]} · {modelLabel(s.provider, s.model)}
          </div>
          {p && (p.tags.length > 0 || p.createdBy?.name) && (
            <div className="flow-node-foot">
              {p.tags.slice(0, 4).map((t) => (
                <span key={t} className="tag-chip ro">
                  <span className="tdot" style={{ background: labelColor(t, labels) }} />
                  {t}
                </span>
              ))}
              {p.createdBy?.name && (
                <span className="flow-by">
                  <span className="flow-avatar">{p.createdBy.name.charAt(0).toUpperCase()}</span>
                  {p.createdBy.name}
                </span>
              )}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flow-node-actions">
            <button className="icon-mini" title="Move up" onClick={() => move(i, -1)}>↑</button>
            <button className="icon-mini" title="Move down" onClick={() => move(i, 1)}>↓</button>
            <button className="icon-mini danger" title="Remove" onClick={() => removeStep(i)}>×</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <EditorShell
      wide
      onBack={() => navigate('/pipelines')}
      title={
        <input
          className="eshell-name"
          value={name}
          disabled={!canEdit || runMode}
          onChange={(e) => mark(setName)(e.target.value)}
          placeholder="Pipeline name"
        />
      }
      actions={
        runMode ? undefined : (
          <EditorActions
            onConfirm={() => void save()}
            onCancel={() => navigate('/pipelines')}
            confirmDisabled={!canEdit || saving || (isNew ? !name.trim() : !dirty)}
            confirmTitle={isNew ? 'Create pipeline' : 'Save changes'}
          />
        )
      }
    >
      {/* test trigger (build) / run controls (testing) — no project here */}
      {runMode && run ? (
        <div className="run-bar">
          <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} onClick={() => setRunMode(false)}>
            ‹ Builder
          </button>
          <span className={`badge status-${run.status}`}>{RUN_STATUS_LABEL[run.status] ?? run.status}</span>
          <span className="run-bar-proj">Test run</span>
          <div className="run-bar-actions">
            <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={runActions.busy || run.status === 'done'} onClick={runActions.runAll}>
              Run all
            </button>
            <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={runActions.busy || run.status !== 'running'} onClick={runActions.stop}>
              Stop
            </button>
            <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={runActions.busy} onClick={runActions.reset}>
              Reset
            </button>
          </div>
        </div>
      ) : !isNew ? (
        <div className="run-bar">
          <span className="run-bar-label">Test</span>
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            disabled={steps.length === 0 || creatingRun || saving}
            onClick={() => void startTest()}
          >
            {creatingRun ? 'Testing…' : 'Test ▶'}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            {steps.length === 0 ? 'Add a step to test' : 'Runs with no project · {note} fills from the note'}
          </span>
        </div>
      ) : null}

      {runMode && run ? (
        <RunFlow
          run={run}
          busy={runActions.busy}
          hasKey={(p) => keysSet.has(p)}
          onRunStep={runActions.runStep}
          onApprove={runActions.approve}
          onSavePrompt={runActions.savePrompt}
        />
      ) : (
      <>
      <div className="pb-top">
        <input
          className="text-input pb-desc"
          value={description}
          disabled={!canEdit}
          onChange={(e) => mark(setDescription)(e.target.value)}
          placeholder="Note (optional) — available to prompts as {note}"
        />
        <div className="pb-tags">
          <LabelPicker
            value={tags}
            labels={labels}
            onChange={mark(setTags)}
            onCreate={createLabel}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {prompts.length === 0 && (
        <p className="empty">
          No prompts yet — <Link to="/prompts" style={{ color: 'var(--primary)' }}>create a prompt</Link> first to add steps.
        </p>
      )}

      {pager.isMobile ? (
        <div className="flow flow-edit pager">
          {pager.page === 0 && (
            <>
              <div className="flow-cap">● Start</div>
              {canEdit && steps.length === 0 && <Connector onAdd={() => openNew(0)} />}
            </>
          )}
          {pager.page >= 1 && pager.page <= steps.length && (
            <>
              {canEdit && <Connector onAdd={() => openNew(pager.page - 1)} />}
              {renderNode(steps[pager.page - 1], pager.page - 1)}
              {canEdit && pager.page === steps.length && <Connector onAdd={() => openNew(steps.length)} />}
            </>
          )}
          {pager.page === steps.length + 1 && <div className="flow-cap end">◉ End</div>}
          <FlowPagerControls pager={pager} stepCount={steps.length} />
        </div>
      ) : (
        <div className="flow">
          <div className="flow-cap">● Start</div>

          {steps.map((s, i) => (
            <div key={s.id}>
              <Connector onAdd={canEdit ? () => openNew(i) : undefined} />
              {renderNode(s, i)}
            </div>
          ))}

          <Connector onAdd={canEdit ? () => openNew(steps.length) : undefined} />
          <div className="flow-cap end">◉ End</div>
        </div>
      )}

      {ed && (
        <div className="drawer-scrim" onClick={() => setEditing(null)}>
          <div className="drawer addstep" onClick={(e) => e.stopPropagation()}>
            {/* header: title (left) · ✓ add (green) · ✕ cancel (red) */}
            <div className="addstep-head">
              <h3>{editing.isNew ? 'Add Step' : 'Edit Step'}</h3>
              <div className="addstep-actions">
                <EditorActions
                  onConfirm={saveStep}
                  onCancel={() => setEditing(null)}
                  confirmDisabled={!ed.promptId}
                  confirmTitle={editing.isNew ? 'Add step' : 'Save step'}
                />
              </div>
            </div>

            {/* A step just binds a prompt — name/provider/model (and a default
                Auto mode) come from it; gate/auto is toggled on the flow node. */}
            <PromptPicker
              prompts={pickablePrompts}
              labels={labels}
              value={ed.promptId}
              modelLabel={(p) => (p.model ? modelLabel(p.provider ?? Provider.Anthropic, p.model) : '')}
              onChange={(promptId) => {
                const p = pickablePrompts.find((x) => x.id === promptId);
                setEditing({
                  ...editing!,
                  step: {
                    ...ed,
                    promptId,
                    name: p?.title ?? ed.name,
                    provider: p?.provider ?? ed.provider,
                    model: p?.model ?? ed.model,
                  },
                });
              }}
            />
          </div>
        </div>
      )}
      </>
      )}

      {runActions.error && <p className="error">{runActions.error}</p>}

      {detailPrompt && (
        <PromptDetails prompt={detailPrompt} labels={labels} onClose={() => setDetailPrompt(null)} />
      )}
    </EditorShell>
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
