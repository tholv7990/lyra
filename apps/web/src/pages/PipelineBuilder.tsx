import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  defaultModel,
  providerNeedsKey,
  Provider,
  PromptStatus,
  StepMode,
  type ApiKeyInfo,
  type ConditionOp,
  type Paged,
  type Pipeline,
  type PipelineStep,
  type PipelineVariable,
  type Prompt,
  type Run,
} from '@lyra/shared';

// Friendly labels for the condition operators (builder select).
const COND_OPS: { op: ConditionOp; label: string }[] = [
  { op: 'exists', label: 'is set' },
  { op: 'empty', label: 'is empty' },
  { op: 'eq', label: 'equals' },
  { op: 'ne', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'gt', label: 'greater than' },
  { op: 'lt', label: 'less than' },
];
const COND_NEEDS_VALUE = (op: ConditionOp) => op !== 'exists' && op !== 'empty';
import { api } from '../lib/api';
import { useModels } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useRunActions } from '../lib/useRunActions';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { LabelPicker } from '../components/LabelPicker';
import { EditorShell } from '../components/EditorShell';
import { RunFlow } from '../components/RunFlow';
import { useFlowPager } from '../components/FlowPager';
import { PromptPicker } from '../components/PromptPicker';
import { PromptDetails } from '../components/PromptDetails';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { EditorActions } from '../components/EditorActions';
import { StepCard } from '../components/StepCard';
import { StepTestModal } from '../components/StepTestModal';
import { FlowCallbacksProvider, type FlowCallbacks } from '../components/flow/flowCallbacks';
import { buildEditGraph } from '../components/flow/buildGraph';
import { useBreadcrumb } from '../layout/breadcrumb';

const FlowCanvas = lazy(() => import('../components/FlowCanvas'));

const RUN_STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  awaiting_gate: 'Awaiting approval',
  skipped: 'Skipped',
  done: 'Done',
  error: 'Error',
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
  const [missingPromptIds, setMissingPromptIds] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [variables, setVariables] = useState<PipelineVariable[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [testingStep, setTestingStep] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test-from-builder (no project): run the sequence; {note} fills from the
  // pipeline note. Project-context runs live on the project page.
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<Run | null>(null);
  const [runMode, setRunMode] = useState(false);
  const [askRunVars, setAskRunVars] = useState(false); // collect vars/collections before a test run
  const [creatingRun, setCreatingRun] = useState(false);
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null); // full-prompt viewer
  const runActions = useRunActions(run, setRun);
  const pager = useFlowPager(steps.length); // mobile one-step pager (build mode)

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
          setVariables(p.variables ?? []);
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

  useEffect(() => {
    // Prompts referenced by steps but not loaded — and not already known missing.
    const missing = Array.from(new Set(steps.map((s) => s.promptId))).filter(
      (promptId) => promptId && !prompts.some((p) => p.id === promptId) && !missingPromptIds.has(promptId),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((promptId) =>
        api<Prompt>(`/prompts/${promptId}`)
          .then((p) => ({ promptId, p }))
          .catch(() => ({ promptId, p: null as Prompt | null })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const found = results.map((r) => r.p).filter((p): p is Prompt => !!p);
      const notFound = results.filter((r) => !r.p).map((r) => r.promptId);
      if (found.length > 0) {
        setPrompts((list) => {
          const existing = new Set(list.map((p) => p.id));
          return [...list, ...found.filter((p) => !existing.has(p.id))];
        });
      }
      // Confirmed deleted/inactive — record so their steps are flagged (and we
      // don't re-fetch them every render).
      if (notFound.length > 0) {
        setMissingPromptIds((prev) => {
          const next = new Set(prev);
          notFound.forEach((promptId) => next.add(promptId));
          return next;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [steps, prompts, missingPromptIds]);

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
      fanOut: s.fanOut?.over?.trim()
        ? { over: s.fanOut.over.trim(), itemVar: s.fanOut.itemVar?.trim() || undefined }
        : undefined,
      condition: s.condition?.variable?.trim()
        ? {
            variable: s.condition.variable.trim(),
            op: s.condition.op,
            value: COND_NEEDS_VALUE(s.condition.op) ? s.condition.value?.trim() || undefined : undefined,
          }
        : undefined,
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
          body: JSON.stringify({ name: name.trim(), description, tags, steps, variables }),
        });
        setPipeline(created);
        setName(created.name);
        setDescription(created.description);
        setTags(created.tags);
        setSteps(created.steps);
        setVariables(created.variables ?? []);
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
        body: JSON.stringify({ name, description, tags, steps, variables }),
      });
      setPipeline(updated);
      setSteps(updated.steps);
      setVariables(updated.variables ?? []);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save pipeline');
    } finally {
      setSaving(false);
    }
  }

  // Distinct collection names the fan-out steps map over.
  const runFanOutNames = useMemo(
    () => [...new Set(steps.filter((s) => s.fanOut?.over).map((s) => s.fanOut!.over))],
    [steps],
  );

  // Open the values form first when the pipeline declares variables or fans out;
  // otherwise run straight away.
  function triggerTest() {
    if (isNew || !id || !wsId || steps.length === 0 || creatingRun) return;
    if (variables.length > 0 || runFanOutNames.length > 0) setAskRunVars(true);
    else void startTest({}, {});
  }

  // Test-run this pipeline with no project (typed/blank context) + the entered
  // variable values and fan-out items, then light up the same flow. Auto-saves
  // unsaved edits first.
  async function startTest(
    values: Record<string, string>,
    collections: Record<string, string[]>,
  ) {
    if (isNew || !id || !wsId || steps.length === 0 || creatingRun) return;
    setAskRunVars(false);
    setCreatingRun(true);
    setError(null);
    try {
      if (dirty) {
        const updated = await api<Pipeline>(`/pipelines/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, description, tags, steps, variables }),
        });
        setPipeline(updated);
        setSteps(updated.steps);
        setVariables(updated.variables ?? []);
        setDirty(false);
      }
      const created = await api<Run>(`/workspaces/${wsId}/pipelines/${id}/test-runs`, {
        method: 'POST',
        body: JSON.stringify({ variables: values, collections }),
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
  // Desktop existing pipeline: name shows in the breadcrumb, so merge the note +
  // tags into the header row. On mobile the app top bar (breadcrumb) is hidden, so
  // keep the name in the header there and leave note + tags in the body.
  const compactHead = !isNew && !pager.isMobile;

  // Actions flow out of the step cards (canvas + pager) through this context, so
  // StepCard stays a pure presentational component with no closure over builder state.
  const flowCbs: FlowCallbacks = {
    busy: false,
    onEdit: openEdit,
    onToggleMode: toggleMode,
    onMove: move,
    onRemove: removeStep,
    onInsert: openNew,
    onViewPrompt: (id) => {
      const pr = prompts.find((x) => x.id === id);
      if (pr) setDetailPrompt(pr);
    },
    onTestStep: (index) => setTestingStep(index),
  };

  // One editable step node — reused by the desktop canvas (Task 9) and the mobile pager.
  const renderNode = (s: PipelineStep, i: number) => (
    <FlowCallbacksProvider value={flowCbs}>
      <StepCard
        step={s}
        index={i}
        canEdit={canEdit}
        prompt={prompts.find((x) => x.id === s.promptId)}
        labels={labels}
        modelLabel={modelLabel}
        promptMissing={!!s.promptId && missingPromptIds.has(s.promptId)}
      />
    </FlowCallbacksProvider>
  );

  return (
    <EditorShell
      wide
      onBack={() => navigate('/pipelines')}
      title={
        !compactHead ? (
          <input
            className="eshell-name"
            value={name}
            disabled={!canEdit || runMode}
            onChange={(e) => mark(setName)(e.target.value)}
            placeholder="Pipeline name"
          />
        ) : (
          // Desktop existing: name lives in the breadcrumb, so reuse the header
          // row for the note + tags — no separate strip, less wasted top space.
          <div className="pb-headrow">
            <input
              className="pb-note"
              value={description}
              disabled={!canEdit || runMode}
              onChange={(e) => mark(setDescription)(e.target.value)}
              placeholder="Note (optional) — available to prompts as {note}"
            />
            {!runMode && (
              <div className="pb-tags">
                <LabelPicker value={tags} labels={labels} onChange={mark(setTags)} onCreate={createLabel} />
              </div>
            )}
          </div>
        )
      }
      actions={
        runMode ? undefined : (
          <>
            {!isNew && (
              <button
                className="btn-primary"
                style={{ width: 'auto', marginTop: 0 }}
                disabled={steps.length === 0 || creatingRun || saving}
                onClick={triggerTest}
                title="Runs with no project · {note} fills from the note"
              >
                {creatingRun ? 'Testing…' : 'Test ▶'}
              </button>
            )}
            <EditorActions
              onConfirm={() => void save()}
              onCancel={() => navigate('/pipelines')}
              confirmDisabled={!canEdit || saving || (isNew ? !name.trim() : !dirty)}
              confirmTitle={isNew ? 'Create pipeline' : 'Save changes'}
            />
          </>
        )
      }
    >
      {/* run controls only while testing — the Test ▶ trigger lives in the header */}
      {runMode && run ? (
        <>
          <div className="run-bar run-view-bar">
            <button className="txt-btn run-back" onClick={() => setRunMode(false)}>
              Back to editing
            </button>
            <span className="run-bar-proj"><strong>Test run</strong></span>
            <span className={`badge status-${run.status}`}>{RUN_STATUS_LABEL[run.status] ?? run.status}</span>
            <div className="run-view-actions">
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={runActions.busy || run.status === 'done'} onClick={runActions.runAll}>
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
        </>
      ) : null}

      {runMode && run ? (
        <RunFlow
          run={run}
          busy={runActions.busy}
          hasKey={(p) => !providerNeedsKey(p as Provider) || keysSet.has(p)}
          onRunStep={runActions.runStep}
          onApprove={runActions.approve}
          onSavePrompt={runActions.savePrompt}
          mobileLayout="flow"
        />
      ) : (
      <>
      <div className="pb-meta">
        {!compactHead && (
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
        )}

        {error && <p className="error">{error}</p>}
        {prompts.length === 0 && (
          <p className="empty">
            No prompts yet — <Link to="/prompts" style={{ color: 'var(--primary)' }}>create a prompt</Link> first to add steps.
          </p>
        )}
      </div>

      {pager.isMobile ? (
        // Mobile: the whole pipeline as a scrollable vertical overview (every step
        // visible at once, tap a card to edit, + between cards to insert).
        <div className="flow flow-edit">
          <div className="flow-cap">● Start</div>
          {canEdit && <Connector onAdd={() => openNew(0)} />}
          {steps.map((s, i) => (
            <Fragment key={s.id}>
              {renderNode(s, i)}
              {canEdit && <Connector onAdd={() => openNew(i + 1)} />}
            </Fragment>
          ))}
          <div className="flow-cap end">◉ End</div>
        </div>
      ) : (
        <Suspense fallback={<div className="flow-canvas loading">Loading canvas…</div>}>
          <FlowCanvas
            graph={buildEditGraph({ steps, canEdit })}
            callbacks={flowCbs}
            editData={{ prompts, labels, modelLabel, missing: missingPromptIds }}
          />
        </Suspense>
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

            {/* Fan-out: run this step once per item in a run collection (parallel). */}
            <div className="addstep-fanout">
              <label className="addstep-fanout-row">
                <input
                  type="checkbox"
                  checked={!!ed.fanOut}
                  onChange={(e) =>
                    setEditing({
                      ...editing!,
                      step: { ...ed, fanOut: e.target.checked ? { over: ed.fanOut?.over ?? '' } : undefined },
                    })
                  }
                />
                <span><strong>Fan out</strong> — run this step once per item in a collection, in parallel</span>
              </label>
              {ed.fanOut && (
                <div className="addstep-fanout-fields">
                  <label className="addstep-fanout-field">
                    <span>Collection name</span>
                    <input
                      className="text-input"
                      placeholder="e.g. images"
                      value={ed.fanOut.over}
                      onChange={(e) =>
                        setEditing({
                          ...editing!,
                          step: { ...ed, fanOut: { ...ed.fanOut!, over: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } },
                        })
                      }
                    />
                  </label>
                  <p className="muted addstep-fanout-help">
                    Each item fills <code>{'{item}'}</code> (and <code>{'{input}'}</code>) in the prompt. You enter the items when you run.
                  </p>
                </div>
              )}
            </div>

            {/* Condition: run this step only when a run variable matches; else skip. */}
            <div className="addstep-cond">
              <label className="addstep-fanout-row">
                <input
                  type="checkbox"
                  checked={!!ed.condition}
                  onChange={(e) =>
                    setEditing({
                      ...editing!,
                      step: {
                        ...ed,
                        condition: e.target.checked
                          ? ed.condition ?? { variable: '', op: 'exists' }
                          : undefined,
                      },
                    })
                  }
                />
                <span><strong>Condition</strong> — run this step only when a variable matches (else skip it)</span>
              </label>
              {ed.condition && (
                <div className="addstep-cond-fields">
                  <span className="addstep-cond-when">when</span>
                  <input
                    className="text-input addstep-cond-var"
                    placeholder="variable"
                    value={ed.condition.variable}
                    onChange={(e) =>
                      setEditing({
                        ...editing!,
                        step: { ...ed, condition: { ...ed.condition!, variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } },
                      })
                    }
                  />
                  <select
                    className="text-input addstep-cond-op"
                    value={ed.condition.op}
                    onChange={(e) =>
                      setEditing({
                        ...editing!,
                        step: { ...ed, condition: { ...ed.condition!, op: e.target.value as ConditionOp } },
                      })
                    }
                  >
                    {COND_OPS.map((o) => (
                      <option key={o.op} value={o.op}>{o.label}</option>
                    ))}
                  </select>
                  {COND_NEEDS_VALUE(ed.condition.op) && (
                    <input
                      className="text-input addstep-cond-val"
                      placeholder="value"
                      value={ed.condition.value ?? ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing!,
                          step: { ...ed, condition: { ...ed.condition!, value: e.target.value } },
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {runActions.error && <p className="error">{runActions.error}</p>}

      {detailPrompt && (
        <PromptDetails prompt={detailPrompt} labels={labels} onClose={() => setDetailPrompt(null)} />
      )}

      {askRunVars && (
        <RunVariablesModal
          title="Test run"
          variables={variables}
          collections={runFanOutNames}
          busy={creatingRun}
          onCancel={() => setAskRunVars(false)}
          onRun={(values, collections) => void startTest(values, collections)}
        />
      )}

      {testingStep !== null && steps[testingStep] && (
        <StepTestModal
          wsId={wsId ?? ''}
          title={steps[testingStep].name}
          promptId={steps[testingStep].promptId}
          initialPrompt={prompts.find((x) => x.id === steps[testingStep].promptId)?.content ?? ''}
          initialMedia={prompts.find((x) => x.id === steps[testingStep].promptId)?.media ?? []}
          provider={steps[testingStep].provider}
          model={steps[testingStep].model}
          catalog={catalog}
          onClose={() => setTestingStep(null)}
        />
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
