import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  providerNeedsKey,
  keyProviderFor,
  ImageOp,
  ProjectStatus,
  StepStatus,
  TaskStatus,
  TaskPriority,
  WorkspaceType,
  type ApiKeyInfo,
  type Asset,
  type MemberView,
  type Pipeline,
  type Product,
  type Project,
  type Provider,
  type Run,
  type Task,
} from '@lyra/shared';
import { api } from '../lib/api';
import { projectProductsApi } from '../lib/products';
import { RUN_STATUS_LABEL_KEY } from '../lib/constants';
import { fmtDate, initial, avatarStyle } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { previewRunProgress } from '../lib/useRunActions';
import { EditorShell } from '../components/EditorShell';
import { MenuPicker, type MenuPickerOption } from '../components/MenuPicker';
import { TagChip } from '../components/TagChip';
import { RunTimeline } from '../components/RunTimeline';
import { RunRating } from '../components/RunRating';
import type { StepHistoryEntry } from '../components/StepResultModal';
import { RunSummary } from '../components/RunSummary';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { CheckIcon, PipelinesIcon, PlayIcon } from '../layout/icons';
import { TaskStatusIcon } from '../components/TaskStatusIcon';
import { TaskStatusPicker } from '../components/TaskStatusPicker';
import { TaskPriorityPicker } from '../components/TaskPriorityPicker';
import { LabelPicker } from '../components/LabelPicker';
import { useLabels } from '../lib/useLabels';
import { useBreadcrumb } from '../layout/breadcrumb';
import './taskdetail.css';

// Suppress unused import — ProjectStatus used for type-narrowing imports only
void ProjectStatus;

// Distinct collection names the pipeline's fan-out steps map over.
function fanOutNames(p: Pipeline): string[] {
  return [...new Set(p.steps.filter((s) => s.fanOut?.over).map((s) => s.fanOut!.over))];
}

export function TaskDetail() {
  const { t } = useTranslation();
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const statusLabel = (status: string): string =>
    RUN_STATUS_LABEL_KEY[status] ? t(RUN_STATUS_LABEL_KEY[status]) : status;
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { labels, createLabel } = useLabels(wsId);

  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [library, setLibrary] = useState<Pipeline[]>([]);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [runAssets, setRunAssets] = useState<Asset[]>([]);
  const [activePipeId, setActivePipeId] = useState<string | null>(null);
  const [runSelOpen, setRunSelOpen] = useState(false);
  const initedRef = useRef(false);
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [askVarsFor, setAskVarsFor] = useState<Pipeline | null>(null);
  const [adding, setAdding] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [projectCopies, setProjectCopies] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline title/description editing (saved with the ✓ when changed).
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');

  useBreadcrumb(task?.name ?? '…', { label: project?.name ?? '…', to: `/projects/${projectId}` });

  const load = useCallback(async () => {
    if (!projectId || !taskId) return;
    setLoading(true);
    try {
      const [proj, tsk] = await Promise.all([
        api<Project>(`/projects/${projectId}`),
        api<Task>(`/projects/${projectId}/tasks/${taskId}`),
      ]);
      setProject(proj);
      setTask(tsk);
      setTitleDraft(tsk.name);
      setDescDraft(tsk.description ?? '');
      const effectiveWsId = tsk.workspaceId;
      const [lib, rs, keys, mems, copies] = await Promise.all([
        api<Pipeline[]>(`/workspaces/${effectiveWsId}/pipelines`),
        api<Run[]>(`/projects/${projectId}/tasks/${taskId}/runs`),
        api<ApiKeyInfo[]>(`/workspaces/${effectiveWsId}/keys`),
        api<MemberView[]>(`/workspaces/${effectiveWsId}/members`),
        projectProductsApi.list(projectId).catch(() => [] as Product[]),
      ]);
      setLibrary(lib);
      setRuns(rs);
      setKeysSet(new Set(keys.map((k) => k.provider)));
      setMembers(mems);
      setProjectCopies(copies);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!run) { setRunAssets([]); return; }
    let cancelled = false;
    api<Asset[]>(`/runs/${run.id}/assets`)
      .then((a) => !cancelled && setRunAssets(a))
      .catch(() => !cancelled && setRunAssets([]));
    return () => { cancelled = true; };
  }, [run]);

  const historyForStep = useCallback(
    (i: number): StepHistoryEntry[] => {
      if (!run) return [];
      const name = run.steps[i]?.name;
      return runs
        .filter((r) => r.id !== run.id && r.pipelineId === run.pipelineId)
        .map((r) => ({ r, s: r.steps[i] }))
        .filter(
          ({ s }) =>
            !!s &&
            (!!s.result || s.status === StepStatus.Error) &&
            (!name || !s.name || s.name === name),
        )
        .sort((a, b) => (a.r.createdAt < b.r.createdAt ? 1 : -1))
        .map(({ r, s }) => ({
          runId: r.id,
          createdAt: r.createdAt,
          status: s!.status,
          result: s!.result,
          error: s!.error,
        }));
    },
    [run, runs],
  );

  async function act<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  const canEdit = useMemo(
    () =>
      !!user &&
      !!current &&
      !!project &&
      project.workspaceId === current.id &&
      canEditProject(
        { createdBy: project.createdBy.id },
        { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
      ),
    [user, current, project],
  );

  async function patchTask(patch: {
    name?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
    pipelines?: string[];
    tags?: string[];
  }) {
    if (!projectId || !taskId || !canEdit || savingTask) return;
    setSavingTask(true);
    setError(null);
    try {
      const updated = await api<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
    } finally {
      setSavingTask(false);
    }
  }

  const byId = useMemo(() => new Map(library.map((p) => [p.id, p])), [library]);
  const assigned = useMemo(
    () => (task?.pipelines ?? []).map((pid) => byId.get(pid)).filter((p): p is Pipeline => !!p),
    [task, byId],
  );
  const unassigned = useMemo(
    () => library.filter((p) => !(task?.pipelines ?? []).includes(p.id)),
    [task, library],
  );

  const projectVars = useMemo(
    () => Object.fromEntries((project?.variables ?? []).map((v) => [v.key, v.value])),
    [project],
  );

  // Workbench: pipeline tabs + the run shown for the active tab. Run #N is the
  // creation order within a pipeline (oldest = #1).
  const activePipeline = activePipeId ? byId.get(activePipeId) ?? null : null;
  const pipeRuns = useMemo(() => runs.filter((r) => r.pipelineId === activePipeId), [runs, activePipeId]);
  const earlierRuns = useMemo(() => pipeRuns.filter((r) => r.id !== run?.id), [pipeRuns, run]);
  const runNumber = useMemo(() => {
    const m = new Map<string, number>();
    const groups = new Map<string, Run[]>();
    for (const r of runs) {
      const k = r.pipelineId ?? '';
      const arr = groups.get(k) ?? [];
      arr.push(r);
      groups.set(k, arr);
    }
    for (const arr of groups.values()) [...arr].reverse().forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [runs]);

  // Pick the first tab + its latest run once the data lands.
  useEffect(() => {
    if (initedRef.current || loading || assigned.length === 0) return;
    initedRef.current = true;
    const first = runs[0];
    const pid = first && assigned.some((p) => p.id === first.pipelineId) ? first.pipelineId! : assigned[0].id;
    setActivePipeId(pid);
    setRun(runs.find((r) => r.pipelineId === pid) ?? null);
  }, [loading, assigned, runs]);

  const selectPipe = (pid: string) => {
    setActivePipeId(pid);
    setRunSelOpen(false);
    setRun(runs.find((r) => r.pipelineId === pid) ?? null);
  };

  const savePipelines = (ids: string[]) =>
    act(async () => {
      const updated = await api<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pipelines: ids }),
      });
      setTask(updated);
    });

  const attachPipeline = (pid: string) => {
    setAdding(false);
    return savePipelines([...(task?.pipelines ?? []), pid]);
  };

  const startRun = (
    pipelineId: string,
    values: Record<string, string>,
    collections: Record<string, string[]> = {},
    productId?: string,
  ) =>
    act(async () => {
      const body: Record<string, unknown> = { variables: values, collections };
      if (productId) body.productId = productId;
      const created = await api<Run>(`/projects/${projectId}/tasks/${taskId}/pipelines/${pipelineId}/runs`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRun(created);
      setRuns((r) => [created, ...r]);
      setActivePipeId(pipelineId);
      setAskVarsFor(null);
    });

  const runPipeline = (pipeline: Pipeline) => {
    if (pipeline.variables.length > 0 || fanOutNames(pipeline).length > 0) setAskVarsFor(pipeline);
    else void startRun(pipeline.id, {}, {}, selectedProductId || undefined);
  };

  const openRun = (r: Run) => { setRun(r); setActivePipeId(r.pipelineId ?? null); };

  const runAll = () =>
    run &&
    act(async () => {
      const before = run;
      setRun(previewRunProgress(run));
      try {
        setRun(await api<Run>(`/runs/${run.id}/run-all`, { method: 'POST' }));
      } catch (err) {
        setRun(before);
        throw err;
      }
    });
  const stop = () =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/stop`, { method: 'POST' })));
  const reset = () =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/reset`, { method: 'POST' })));
  const runStep = (i: number) =>
    run &&
    act(async () => {
      const before = run;
      setRun(previewRunProgress(run, i));
      try {
        setRun(await api<Run>(`/runs/${run.id}/steps/${i}/run`, { method: 'POST' }));
      } catch (err) {
        setRun(before);
        throw err;
      }
    });
  const approve = (i: number) =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/steps/${i}/approve`, { method: 'POST' })));
  const reject = (i: number) =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/steps/${i}/reject`, { method: 'POST' })));
  const regenerate = (i: number) =>
    run &&
    act(async () => {
      const before = run;
      setRun(previewRunProgress(run, i));
      try {
        setRun(await api<Run>(`/runs/${run.id}/steps/${i}/run`, { method: 'POST', body: JSON.stringify({ bypassCache: true }) }));
      } catch (err) {
        setRun(before);
        throw err;
      }
    });
  const savePrompt = (i: number, prompt: string) =>
    run &&
    act(async () =>
      setRun(
        await api<Run>(`/runs/${run.id}/steps/${i}/prompt`, {
          method: 'PATCH',
          body: JSON.stringify({ prompt }),
        }),
      ),
    );
  const imageAction = (sourceStepIndex: number, assetId: string, op: ImageOp) =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/actions/image`, { method: 'POST', body: JSON.stringify({ sourceStepIndex, assetId, op }) })));
  const rate = (value: 'up' | 'down' | null) =>
    run &&
    act(async () => {
      const updated = await api<Run>(`/runs/${run.id}/rating`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      setRun(updated);
      setRuns((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    });

  const isPersonal = current?.type === WorkspaceType.Personal;

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!task || !project) return <p className="empty">{error ?? t('tasks.loadFailed')}</p>;

  return (
    <EditorShell
      wide
      crumb={{ label: project?.name ?? '…', to: `/projects/${projectId}` }}
      onClose={() => navigate(`/projects/${projectId}`)}
      title={
        <h2 className="eshell-name">{task.name}</h2>
      }
    >
      {askVarsFor && (
        <RunVariablesModal
          title={t('projects.runNamed', { name: askVarsFor.name })}
          variables={askVarsFor.variables}
          collections={fanOutNames(askVarsFor)}
          prefill={projectVars}
          busy={busy}
          onCancel={() => setAskVarsFor(null)}
          onRun={(values, collections) => void startRun(askVarsFor.id, values, collections, selectedProductId || undefined)}
        />
      )}

      <div className="proj-page">
          <div className="tw-single">
            {error && <p className="error">{error}</p>}

            {/* Task title + description — editable inline; ✓ saves when changed. */}
            <div className="tw-title">
              {canEdit ? (
                <input
                  className="tw-title-input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder={t('tasks.namePlaceholder')}
                />
              ) : (
                <h1>{task.name}</h1>
              )}
              {canEdit && (titleDraft !== task.name || descDraft !== (task.description ?? '')) && (
                <button
                  type="button"
                  className="icon-btn-success tw-save"
                  disabled={savingTask || !titleDraft.trim()}
                  onClick={() => void patchTask({ name: titleDraft.trim(), description: descDraft })}
                  title={t('common.save')}
                  aria-label={t('common.save')}
                >
                  <CheckIcon width={16} height={16} />
                </button>
              )}
            </div>
            {canEdit ? (
              <textarea
                className="tw-desc-input"
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={2}
              />
            ) : (
              <p className="tw-desc">{task.description || t('tasks.descriptionPlaceholder')}</p>
            )}

            {/* Properties — compact inline row (single-column, no sidebar) */}
            <div className="tw-props">
              <TaskStatusPicker status={task.status} disabled={!canEdit || savingTask} onChange={(s) => void patchTask({ status: s })} />
              <TaskPriorityPicker priority={task.priority} disabled={!canEdit || savingTask} onChange={(p) => void patchTask({ priority: p })} />
              {!isPersonal && (
                <div className="task-assignee-wrap">
                  <button className="btn-ghost task-assignee-btn btn-inline" disabled={!canEdit || savingTask} onClick={() => setAssigneeOpen((o) => !o)} aria-label={t('tasks.assignee')}>
                    {task.assignee ? (
                      <>
                        <span className="prow-updated-icon" style={avatarStyle(task.assignee.name)} aria-hidden="true">{initial(task.assignee.name)}</span>
                        {task.assignee.name}
                      </>
                    ) : t('tasks.unassigned')}
                  </button>
                  {assigneeOpen && canEdit && (
                    <div className="lin-menu task-assignee-menu">
                      <button className="lin-menu-item" onClick={() => { void patchTask({ assigneeId: null }); setAssigneeOpen(false); }}>{t('tasks.unassigned')}</button>
                      {members.map((m) => (
                        <button key={m.userId} className="lin-menu-item" onClick={() => { void patchTask({ assigneeId: m.userId }); setAssigneeOpen(false); }}>
                          <span className="prow-updated-icon" style={avatarStyle(m.name)} aria-hidden="true">{initial(m.name)}</span>
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {canEdit ? (
                <LabelPicker value={task.tags} labels={labels} onChange={(tags) => void patchTask({ tags })} onCreate={createLabel} />
              ) : task.tags.length > 0 ? (
                <div className="task-tags-read">
                  {task.tags.map((name) => (
                    <TagChip key={name} label={name} labels={labels} />
                  ))}
                </div>
              ) : null}
            </div>

            {assigned.length === 0 ? (
              <div className="prompt-empty">
                <h3>{t('projects.noPipelinesTitle')}</h3>
                <p>
                  {library.length === 0 ? (
                    <>
                      {t('projects.noPipelinesCreatePre')}{' '}
                      <a href="/pipelines" style={{ color: 'var(--primary)' }}>{t('projects.pipelines')}</a>{' '}
                      {t('projects.noPipelinesCreatePost')}
                    </>
                  ) : canEdit ? (
                    <>{t('projects.noPipelinesAddPre')} <strong>{t('projects.addPipeline')}</strong> {t('projects.noPipelinesAddPost')}</>
                  ) : (
                    <>{t('projects.noPipelinesViewer')}</>
                  )}
                </p>
              </div>
            ) : (
              <>
                {/* Pipeline tabs */}
                <div className="tw-tabs">
                  {assigned.map((p) => (
                    <button key={p.id} type="button" className={`tw-tab${activePipeId === p.id ? ' active' : ''}`} onClick={() => selectPipe(p.id)} title={p.name}>
                      <PipelinesIcon width={14} height={14} />
                      <span className="tw-tab-name">{p.name}</span>
                    </button>
                  ))}
                  {canEdit && unassigned.length > 0 && (
                    <div className="tw-tab-assign">
                      <button type="button" className="tw-tab muted" onClick={() => setAdding((s) => !s)}>
                        {t('projects.addPipeline')}
                      </button>
                      {adding && (
                        <div className="lin-menu tw-assign-menu">
                          {unassigned.map((p) => (
                            <button key={p.id} className="lin-menu-item" disabled={busy} onClick={() => void attachPipeline(p.id)}>
                              {p.name}
                              <span className="lin-menu-count">{t('projects.stepCount', { count: p.steps.length })}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Run header + timeline, or a no-run start state */}
                {run && run.pipelineId === activePipeId ? (
                  <>
                    <div className="tw-runhead">
                      <div className="tw-runhead-l">
                        <div className="tw-runsel-wrap">
                          <button type="button" className="tw-runsel" disabled={pipeRuns.length <= 1} onClick={() => setRunSelOpen((o) => !o)}>
                            {t('run.runNumber', { n: runNumber.get(run.id) ?? 1 })}
                            {pipeRuns.length > 1 && (
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m4.5 6.5 3.5 3 3.5-3" /></svg>
                            )}
                          </button>
                          {runSelOpen && (
                            <div className="lin-menu tw-runsel-menu">
                              {pipeRuns.map((r) => (
                                <button key={r.id} className="lin-menu-item" onClick={() => { setRun(r); setRunSelOpen(false); }}>
                                  {t('run.runNumber', { n: runNumber.get(r.id) ?? 1 })}
                                  <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`tw-runstatus status-${run.status}`}><span className="tw-runstatus-dot" />{statusLabel(run.status)}</span>
                        <span className="tw-runmeta">{t('run.startedBy', { date: fmtDate(run.createdAt), name: run.createdBy.name })}</span>
                      </div>
                      <div className="tw-runhead-r">
                        <button className="btn-ghost btn-inline btn-sm" disabled={busy || run.status === 'done'} onClick={runAll}>{t('run.runAll')}</button>
                        <button className="btn-ghost btn-inline btn-sm" disabled={busy || run.status !== 'running'} onClick={stop}>{t('run.stop')}</button>
                        <button className="btn-ghost btn-inline btn-sm" disabled={busy} onClick={reset}>{t('run.reset')}</button>
                        {run.steps.some((s) => s.status === StepStatus.Done) && <RunRating value={run.rating} disabled={busy} onRate={rate} />}
                      </div>
                    </div>
                    {run.steps.length === 0 ? (
                      <p className="empty">{t('projects.noStepsYet')}</p>
                    ) : (
                      <>
                        <RunTimeline
                          run={run}
                          busy={busy}
                          hasKey={(p) => !providerNeedsKey(p as Provider) || keysSet.has(keyProviderFor(p as Provider))}
                          onRunStep={runStep}
                          onApprove={approve}
                          onReject={reject}
                          onSavePrompt={savePrompt}
                          onRegenerate={regenerate}
                          onImageAction={imageAction}
                          assets={runAssets}
                          historyForStep={historyForStep}
                        />
                        <RunSummary run={run} busy={busy} onRetry={runStep} />
                      </>
                    )}
                  </>
                ) : (
                  <div className="tw-norun">
                    <p className="muted">{t('run.noRunsForPipeline')}</p>
                    {canEdit && activePipeline && projectCopies.length > 0 && (() => {
                      const productOptions: MenuPickerOption<string>[] = [
                        { value: '', label: t('tasks.noProduct') },
                        ...projectCopies.map((p) => ({ value: p.id, label: p.name })),
                      ];
                      return (
                        <div className="tw-product-pick">
                          <span className="muted" style={{ fontSize: 13 }}>{t('tasks.pickProduct')}</span>
                          <MenuPicker<string>
                            value={selectedProductId}
                            options={productOptions}
                            onChange={setSelectedProductId}
                            ariaLabel={t('tasks.pickProduct')}
                          />
                        </div>
                      );
                    })()}
                    {canEdit && activePipeline && (
                      <button className="btn-primary btn-inline" disabled={busy || activePipeline.steps.length === 0} onClick={() => runPipeline(activePipeline)}>
                        <PlayIcon width={13} height={13} /> {t('projects.runPipeline')}
                      </button>
                    )}
                  </div>
                )}

                {/* Earlier runs */}
                {earlierRuns.length > 0 && (
                  <div className="tw-earlier">
                    <div className="tw-earlier-h">{t('run.earlierRuns')}</div>
                    {earlierRuns.map((r) => (
                      <button key={r.id} type="button" className="tw-earlier-row" onClick={() => openRun(r)}>
                        <span className={`tw-earlier-ico status-${r.status}`}><TaskStatusIcon status={task.status} size={16} /></span>
                        <span className="tw-earlier-name">{t('run.runNumber', { n: runNumber.get(r.id) ?? 1 })} · {statusLabel(r.status)}</span>
                        <span className="tw-earlier-date">{fmtDate(r.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </EditorShell>
  );
}
