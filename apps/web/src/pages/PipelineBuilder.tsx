import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  defaultModel,
  providerNeedsKey,
  keyProviderFor,
  Provider,
  PromptStatus,
  StepMode,
  type ApiKeyInfo,
  type ConditionOp,
  type GeneratedPipeline,
  type Paged,
  type Pipeline,
  type PipelineOrigin,
  type PipelineStep,
  type PipelineVariable,
  type Prompt,
  type Run,
} from '@lyra/shared';

// Friendly labels for the condition operators (builder select). Label keys are
// resolved via i18n at render.
const COND_OPS: { op: ConditionOp; labelKey: string }[] = [
  { op: 'exists', labelKey: 'pipelines.condOpExists' },
  { op: 'empty', labelKey: 'pipelines.condOpEmpty' },
  { op: 'eq', labelKey: 'pipelines.condOpEq' },
  { op: 'ne', labelKey: 'pipelines.condOpNe' },
  { op: 'contains', labelKey: 'pipelines.condOpContains' },
  { op: 'gt', labelKey: 'pipelines.condOpGt' },
  { op: 'lt', labelKey: 'pipelines.condOpLt' },
];
const COND_NEEDS_VALUE = (op: ConditionOp) => op !== 'exists' && op !== 'empty';
import { api } from '../lib/api';
import { openPromptInChat } from '../lib/openPromptInChat';
import { RUN_STATUS_LABEL_KEY } from '../lib/constants';
import { useModels } from '../lib/useModels';
import { useLabels } from '../lib/useLabels';
import { useRunActions } from '../lib/useRunActions';
import { useScrollLock } from '../lib/useScrollLock';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { LabelPicker } from '../components/LabelPicker';
import { EditorShell } from '../components/EditorShell';
import { BuildWithAiModal } from '../components/BuildWithAiModal';
import { RunFlow } from '../components/RunFlow';
import { useFlowPager } from '../components/FlowPager';
import { PromptPicker } from '../components/PromptPicker';
import { PromptDetails } from '../components/PromptDetails';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { EditorActions } from '../components/EditorActions';
import { StepCard } from '../components/StepCard';
import { CheckIcon, PlayIcon, SparkleIcon } from '../layout/icons';
import { FlowCallbacksProvider, type FlowCallbacks } from '../components/flow/flowCallbacks';
import { buildEditGraph } from '../components/flow/buildGraph';
import { useBreadcrumb } from '../layout/breadcrumb';

const FlowCanvas = lazy(() => import('../components/FlowCanvas'));

function uuid() {
  return crypto.randomUUID();
}

type Draft = Omit<PipelineStep, 'id'> & { id?: string };
type Editing = { step: Draft; index: number; isNew: boolean } | null;

export function PipelineBuilder() {
  const { t } = useTranslation();
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
  useBreadcrumb(isNew ? name.trim() || t('pipelines.breadcrumbNew') : pipeline?.name ?? '…');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [missingPromptIds, setMissingPromptIds] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [variables, setVariables] = useState<PipelineVariable[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<PipelineOrigin | null>(null);
  const [aiEditOpen, setAiEditOpen] = useState(false); // "Edit with AI" modal

  // Apply an AI revision to the open builder — replaces the steps (gap steps
  // arrive with an empty promptId, badged "needs a prompt"); name/description and
  // provenance are left as the user set them.
  function applyAiDraft(draft: GeneratedPipeline) {
    setSteps(
      draft.steps.map((s) => ({
        id: uuid(),
        name: s.name,
        promptId: s.promptId ?? '',
        provider: s.provider,
        model: s.model,
        mode: s.mode,
      })),
    );
    setDirty(true);
  }

  // Pre-fill a new pipeline from an AI-generated draft handed over via router
  // state (the "Build with AI" modal). Applied exactly once via a ref guard, then
  // the raw history state is cleared (window.history, NOT navigate — navigating
  // here under StrictMode raced the setSteps and dropped the draft). Gap steps
  // arrive with an empty promptId and are badged "needs a prompt".
  const location = useLocation();
  const draftApplied = useRef(false);
  useEffect(() => {
    if (draftApplied.current || !isNew) return;
    const draft = (location.state as { draft?: GeneratedPipeline } | null)?.draft;
    if (!draft) return;
    draftApplied.current = true;
    setName(draft.name);
    setDescription(draft.description);
    setSteps(
      draft.steps.map((s) => ({
        id: uuid(),
        name: s.name,
        promptId: s.promptId ?? '',
        provider: s.provider,
        model: s.model,
        mode: s.mode,
      })),
    );
    setOrigin(draft.origin);
    setDirty(true);
    // clear so a refresh doesn't re-apply the draft (doesn't remount the route)
    window.history.replaceState(null, '');
  }, [location.state, isNew]);

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
        .catch((e) => setError(e instanceof Error ? e.message : t('pipelines.loadError')));
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
      setError(t('pipelines.pickPromptError'));
      return;
    }
    // Name/provider/model come from the chosen prompt (set on pick).
    const p = prompts.find((x) => x.id === s.promptId);
    const finalStep: PipelineStep = {
      id: s.id ?? uuid(),
      name: (s.name || p?.title || t('pipelines.defaultStepName')).trim(),
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
          body: JSON.stringify({
            name: name.trim(),
            description,
            tags,
            steps,
            variables,
            ...(origin?.source === 'ai' ? { origin } : {}),
          }),
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
        setError(e instanceof Error ? e.message : t('pipelines.createError'));
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
      setError(e instanceof Error ? e.message : t('pipelines.saveError'));
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
      setError(e instanceof Error ? e.message : t('pipelines.startTestError'));
    } finally {
      setCreatingRun(false);
    }
  }

  // Lock page scroll while the add/edit-step drawer is open. Called above the
  // early return below so the hook order stays stable (Rules of Hooks).
  useScrollLock(!!editing?.step);

  if (!isNew && !pipeline) {
    return <p className="empty">{error ?? t('common.loading')}</p>;
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
    onTestStep: (index) => {
      const step = steps[index];
      const prompt = prompts.find((x) => x.id === step.promptId);
      if (prompt) {
        void openPromptInChat(prompt, {
          wsId: wsId ?? '',
          navigate,
          from: { label: t('nav.pipelines'), to: id ? `/pipelines/${id}` : '/pipelines', record: step.name },
          provider: step.provider,
          model: step.model,
        });
      }
    },
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
        needsPrompt={!s.promptId}
      />
    </FlowCallbacksProvider>
  );

  return (
    <EditorShell
      wide
      crumb={{ label: t('nav.pipelines'), to: '/pipelines' }}
      onClose={() => navigate('/pipelines')}
      title={
        !compactHead ? (
          <input
            className="eshell-name"
            value={name}
            disabled={!canEdit || runMode}
            onChange={(e) => mark(setName)(e.target.value)}
            placeholder={t('pipelines.namePlaceholder')}
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
              placeholder={t('pipelines.notePlaceholder')}
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
            {canEdit && (
              <button
                className="btn-ai"
                onClick={() => setAiEditOpen(true)}
                title={t('pipelines.editWithAi')}
              >
                <SparkleIcon width={14} height={14} />
                <span className="lin-ai-txt">{t('pipelines.editWithAi')}</span>
              </button>
            )}
            {!isNew && (
              <button
                className="btn-primary btn-inline"
                disabled={steps.length === 0 || creatingRun || saving}
                onClick={triggerTest}
                title={t('pipelines.testHint')}
              >
                <PlayIcon width={13} height={13} />
                {creatingRun ? t('pipelines.testing') : t('pipelines.testRunLabel')}
              </button>
            )}
            <button
              type="button"
              className="icon-btn-success"
              disabled={!canEdit || saving || (isNew ? !name.trim() : !dirty)}
              title={isNew ? t('pipelines.createTitle') : t('pipelines.saveChanges')}
              aria-label={isNew ? t('pipelines.createTitle') : t('pipelines.saveChanges')}
              onClick={() => void save()}
            >
              <CheckIcon width={16} height={16} />
            </button>
          </>
        )
      }
    >
      {/* run controls only while testing — the Test ▶ trigger lives in the header */}
      {runMode && run ? (
        <>
          <div className="run-bar run-view-bar">
            <button className="txt-btn run-back" onClick={() => setRunMode(false)}>
              {t('pipelines.backToEditing')}
            </button>
            <span className="run-bar-proj"><strong>{t('pipelines.testRun')}</strong></span>
            <span className={`badge status-${run.status}`}>{RUN_STATUS_LABEL_KEY[run.status] ? t(RUN_STATUS_LABEL_KEY[run.status]) : run.status}</span>
            <div className="run-view-actions">
              <button className="btn-primary btn-inline" disabled={runActions.busy || run.status === 'done'} onClick={runActions.runAll}>
                {t('run.runAll')}
              </button>
              <button className="btn-ghost btn-inline" disabled={runActions.busy || run.status !== 'running'} onClick={runActions.stop}>
                {t('run.stop')}
              </button>
              <button className="btn-ghost btn-inline" disabled={runActions.busy} onClick={runActions.reset}>
                {t('run.reset')}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {runMode && run ? (
        <RunFlow
          run={run}
          busy={runActions.busy}
          hasKey={(p) => !providerNeedsKey(p as Provider) || keysSet.has(keyProviderFor(p as Provider))}
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
              placeholder={t('pipelines.notePlaceholder')}
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
            {t('pipelines.noPromptsBefore')}<Link to="/prompts" style={{ color: 'var(--primary)' }}>{t('pipelines.noPromptsLink')}</Link>{t('pipelines.noPromptsAfter')}
          </p>
        )}
      </div>

      {pager.isMobile ? (
        // Mobile: the whole pipeline as a scrollable vertical overview (every step
        // visible at once, tap a card to edit, + between cards to insert).
        <div className="flow flow-edit">
          <div className="flow-cap">● {t('pipelines.flowStart')}</div>
          {canEdit && <Connector onAdd={() => openNew(0)} />}
          {steps.map((s, i) => (
            <Fragment key={s.id}>
              {renderNode(s, i)}
              {canEdit && <Connector onAdd={() => openNew(i + 1)} />}
            </Fragment>
          ))}
          <div className="flow-cap end">◉ {t('pipelines.flowEnd')}</div>
        </div>
      ) : (
        <Suspense fallback={<div className="flow-canvas loading">{t('pipelines.loadingCanvas')}</div>}>
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
              <h3>{editing.isNew ? t('pipelines.addStep') : t('pipelines.editStep')}</h3>
              <div className="addstep-actions">
                <EditorActions
                  onConfirm={saveStep}
                  onCancel={() => setEditing(null)}
                  confirmDisabled={!ed.promptId}
                  confirmTitle={editing.isNew ? t('pipelines.addStepTitle') : t('pipelines.saveStepTitle')}
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
                <span><strong>{t('pipelines.fanOut')}</strong> {t('pipelines.fanOutDesc')}</span>
              </label>
              {ed.fanOut && (
                <div className="addstep-fanout-fields">
                  <label className="addstep-fanout-field">
                    <span>{t('pipelines.collectionName')}</span>
                    <input
                      className="text-input"
                      placeholder={t('pipelines.collectionPlaceholder')}
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
                    {t('pipelines.fanOutHelpBefore')}<code>{'{item}'}</code>{t('pipelines.fanOutHelpMid')}<code>{'{input}'}</code>{t('pipelines.fanOutHelpAfter')}
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
                <span><strong>{t('pipelines.condition')}</strong> {t('pipelines.conditionDesc')}</span>
              </label>
              {ed.condition && (
                <div className="addstep-cond-fields">
                  <span className="addstep-cond-when">{t('pipelines.when')}</span>
                  <input
                    className="text-input addstep-cond-var"
                    placeholder={t('pipelines.variablePlaceholder')}
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
                      <option key={o.op} value={o.op}>{t(o.labelKey)}</option>
                    ))}
                  </select>
                  {COND_NEEDS_VALUE(ed.condition.op) && (
                    <input
                      className="text-input addstep-cond-val"
                      placeholder={t('pipelines.valuePlaceholder')}
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
        <PromptDetails
          prompt={detailPrompt}
          labels={labels}
          onClose={() => setDetailPrompt(null)}
          chatOrigin={{ label: t('nav.pipelines'), to: id ? `/pipelines/${id}` : '/pipelines', record: detailPrompt.title }}
        />
      )}

      {aiEditOpen && wsId && (
        <BuildWithAiModal
          wsId={wsId}
          current={steps.map((s) => ({
            name: s.name,
            promptId: s.promptId,
            provider: s.provider,
            model: s.model,
            mode: s.mode,
          }))}
          onApply={applyAiDraft}
          onClose={() => setAiEditOpen(false)}
        />
      )}

      {askRunVars && (
        <RunVariablesModal
          title={t('pipelines.testRun')}
          variables={variables}
          collections={runFanOutNames}
          busy={creatingRun}
          onCancel={() => setAskRunVars(false)}
          onRun={(values, collections) => void startTest(values, collections)}
        />
      )}

    </EditorShell>
  );
}

function Connector({ onAdd }: { onAdd?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flow-connector">
      {onAdd && (
        <button className="flow-add" onClick={onAdd} title={t('pipelines.addStepTitle')}>+</button>
      )}
    </div>
  );
}
