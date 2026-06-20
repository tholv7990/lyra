import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  providerNeedsKey,
  keyProviderFor,
  ProjectStatus,
  StepMode,
  StepStatus,
  TaskStatus,
  TaskPriority,
  labelColor,
  WorkspaceType,
  type ApiKeyInfo,
  type Asset,
  type MemberView,
  type Pipeline,
  type Project,
  type Provider,
  type Run,
  type Task,
} from '@lyra/shared';
import { api } from '../lib/api';
import { fmtDate, initial, avatarStyle } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { previewRunProgress } from '../lib/useRunActions';
import { EditorShell } from '../components/EditorShell';
import { RunFlow } from '../components/RunFlow';
import { RunRating } from '../components/RunRating';
import type { StepHistoryEntry } from '../components/StepResultModal';
import { RunSummary } from '../components/RunSummary';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { PencilIcon, PipelinesIcon, PlayIcon, PlusIcon, XIcon } from '../layout/icons';
import { TaskStatusPicker } from '../components/TaskStatusPicker';
import { TaskPriorityPicker } from '../components/TaskPriorityPicker';
import { LabelPicker } from '../components/LabelPicker';
import { useLabels } from '../lib/useLabels';
import { useBreadcrumb } from '../layout/breadcrumb';
import './taskdetail.css';

// Suppress unused import — ProjectStatus used for type-narrowing imports only
void ProjectStatus;

const STATUS_KEY: Record<string, string> = {
  idle: 'run.status_idle',
  queued: 'run.status_queued',
  running: 'run.status_running',
  waiting: 'run.status_waiting',
  awaiting_gate: 'run.status_waiting',
  skipped: 'run.status_skipped',
  done: 'run.status_done',
  error: 'run.status_error',
};

// Distinct collection names the pipeline's fan-out steps map over.
function fanOutNames(p: Pipeline): string[] {
  return [...new Set(p.steps.filter((s) => s.fanOut?.over).map((s) => s.fanOut!.over))];
}

export function TaskDetail() {
  const { t } = useTranslation();
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const statusLabel = (status: string): string =>
    STATUS_KEY[status] ? t(STATUS_KEY[status]) : status;
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
  const [runView, setRunView] = useState(false);
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [askVarsFor, setAskVarsFor] = useState<Pipeline | null>(null);
  const [adding, setAdding] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumb(
    runView && run ? run.pipelineName ?? task?.name ?? '…' : task?.name ?? '…',
    { label: project?.name ?? '…', to: `/projects/${projectId}` },
  );

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
      const effectiveWsId = tsk.workspaceId;
      const [lib, rs, keys, mems] = await Promise.all([
        api<Pipeline[]>(`/workspaces/${effectiveWsId}/pipelines`),
        api<Run[]>(`/projects/${projectId}/tasks/${taskId}/runs`),
        api<ApiKeyInfo[]>(`/workspaces/${effectiveWsId}/keys`),
        api<MemberView[]>(`/workspaces/${effectiveWsId}/members`),
      ]);
      setLibrary(lib);
      setRuns(rs);
      setKeysSet(new Set(keys.map((k) => k.provider)));
      setMembers(mems);
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
  const detachPipeline = (pid: string) =>
    savePipelines((task?.pipelines ?? []).filter((x) => x !== pid));

  const startRun = (
    pipelineId: string,
    values: Record<string, string>,
    collections: Record<string, string[]> = {},
  ) =>
    act(async () => {
      const created = await api<Run>(`/projects/${projectId}/tasks/${taskId}/pipelines/${pipelineId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ variables: values, collections }),
      });
      setRun(created);
      setRuns((r) => [created, ...r]);
      setRunView(true);
      setAskVarsFor(null);
    });

  const runPipeline = (pipeline: Pipeline) => {
    if (pipeline.variables.length > 0 || fanOutNames(pipeline).length > 0) setAskVarsFor(pipeline);
    else void startRun(pipeline.id, {});
  };

  const runAllPipelines = () =>
    act(async () => {
      const created = await api<Run[]>(`/projects/${projectId}/tasks/${taskId}/runs/all`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (created.length > 0) setRuns((r) => [...created, ...r]);
    });

  const openRun = (r: Run) => { setRun(r); setRunView(true); };

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
      onBack={() => navigate(`/projects/${projectId}`)}
      title={
        <h2 className="eshell-name">
          {runView && run ? run.pipelineName ?? t('projects.runFallback') : task.name}
        </h2>
      }
      actions={
        !runView && canEdit ? (
          <button
            type="button"
            className="icon-btn"
            aria-label={t('common.edit')}
            title={t('common.edit')}
            onClick={() => navigate(`/projects/${projectId}/tasks/${taskId}/edit`)}
          >
            <PencilIcon width={16} height={16} />
          </button>
        ) : undefined
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
          onRun={(values, collections) => void startRun(askVarsFor.id, values, collections)}
        />
      )}

      <div className="proj-page">
        {runView && run ? (
          /* ---- Focused run view ---- */
          <div className="run-view">
            <div className="run-bar run-view-bar">
              <button className="txt-btn run-back" onClick={() => setRunView(false)}>
                {t('run.backToProject')}
              </button>
              <span className="run-bar-proj">
                <strong>{run.pipelineName ?? t('projects.runFallback')}</strong>
              </span>
              <span className={`badge status-${run.status}`}>{statusLabel(run.status)}</span>
              {run.steps.some((s) => s.status === StepStatus.Done) && (
                <RunRating value={run.rating} disabled={busy} onRate={rate} />
              )}
              <div className="run-view-actions">
                <button
                  className="btn-primary btn-inline"
                  disabled={busy || run.status === 'done'}
                  onClick={runAll}
                >
                  {t('run.runAll')}
                </button>
                <button
                  className="btn-ghost btn-inline"
                  disabled={busy || run.status !== 'running'}
                  onClick={stop}
                >
                  {t('run.stop')}
                </button>
                <button
                  className="btn-ghost btn-inline"
                  disabled={busy}
                  onClick={reset}
                >
                  {t('run.reset')}
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {run.steps.length === 0 ? (
              <p className="empty">{t('projects.noStepsYet')}</p>
            ) : (
              <>
                <RunFlow
                  run={run}
                  busy={busy}
                  hasKey={(p) => !providerNeedsKey(p as Provider) || keysSet.has(keyProviderFor(p as Provider))}
                  onRunStep={runStep}
                  onApprove={approve}
                  onSavePrompt={savePrompt}
                  mobileLayout="flow"
                  assets={runAssets}
                  historyForStep={historyForStep}
                />
                <RunSummary run={run} busy={busy} onRetry={runStep} />
              </>
            )}
          </div>
        ) : (
          /* ---- Task dashboard (two-column: workbench + Properties sidebar) ---- */
          <div className="td-grid">
            <div className="td-main">
            {/* Description */}
            <p className="proj-product">{task.description || t('tasks.descriptionPlaceholder')}</p>

            {error && <p className="error">{error}</p>}

            {assigned.length === 0 && (
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
            )}

            {/* Recent runs */}
            {runs.length > 0 && (
              <>
                <div className="section-head proj-sec">
                  <h2>{t('run.recentRuns')}</h2>
                </div>
                <div className="list">
                  {runs.map((r) => (
                    <div
                      className="row clickable"
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRun(r)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openRun(r); }}
                    >
                      <div className="grow">
                        <div className="title">{r.pipelineName ?? t('projects.runFallback')}</div>
                        <div className="sub">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                      <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="txt-btn" onClick={() => openRun(r)}>{t('common.open')}</button>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            </div>

            <aside className="td-side">
              <div className="td-side-h">{t('tasks.properties')}</div>

              <div className="td-prop">
                <span className="td-prop-k">{t('tasks.statusLabel')}</span>
                <span className="td-prop-v">
                  <TaskStatusPicker
                    status={task.status}
                    disabled={!canEdit || savingTask}
                    onChange={(s) => void patchTask({ status: s })}
                  />
                </span>
              </div>
              <div className="td-prop">
                <span className="td-prop-k">{t('tasks.priorityLabel')}</span>
                <span className="td-prop-v">
                  <TaskPriorityPicker
                    priority={task.priority}
                    disabled={!canEdit || savingTask}
                    onChange={(p) => void patchTask({ priority: p })}
                  />
                </span>
              </div>
              {!isPersonal && (
                <div className="td-prop">
                  <span className="td-prop-k">{t('tasks.assignee')}</span>
                  <span className="td-prop-v">
                    <div className="task-assignee-wrap">
                      <button
                        className="btn-ghost task-assignee-btn btn-inline"
                        disabled={!canEdit || savingTask}
                        onClick={() => setAssigneeOpen((o) => !o)}
                        aria-label={t('tasks.assignee')}
                      >
                        {task.assignee ? (
                          <>
                            <span className="prow-updated-icon" style={avatarStyle(task.assignee.name)} aria-hidden="true">
                              {initial(task.assignee.name)}
                            </span>
                            {task.assignee.name}
                          </>
                        ) : (
                          t('tasks.unassigned')
                        )}
                      </button>
                      {assigneeOpen && canEdit && (
                        <div className="lin-menu task-assignee-menu">
                          <button
                            className="lin-menu-item"
                            onClick={() => { void patchTask({ assigneeId: null }); setAssigneeOpen(false); }}
                          >
                            {t('tasks.unassigned')}
                          </button>
                          {members.map((m) => (
                            <button
                              key={m.userId}
                              className="lin-menu-item"
                              onClick={() => { void patchTask({ assigneeId: m.userId }); setAssigneeOpen(false); }}
                            >
                              <span className="prow-updated-icon" style={avatarStyle(m.name)} aria-hidden="true">
                                {initial(m.name)}
                              </span>
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </span>
                </div>
              )}
              <div className="td-prop tags">
                <span className="td-prop-k">{t('tasks.tagsLabel')}</span>
                <span className="td-prop-v">
                  {canEdit ? (
                    <LabelPicker
                      value={task.tags}
                      labels={labels}
                      onChange={(tags) => void patchTask({ tags })}
                      onCreate={createLabel}
                    />
                  ) : task.tags.length > 0 ? (
                    <div className="task-tags-read">
                      {task.tags.map((name) => (
                        <span className="tag-chip" key={name}>
                          <span className="tdot" style={{ background: labelColor(name, labels) }} />
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
              </div>

              <div className="td-side-sep" />
              <div className="td-pipes-h">
                <span>{t('projects.pipelines')}</span>
                {assigned.length > 1 && (
                  <button type="button" className="td-pipes-runall" disabled={busy} onClick={runAllPipelines} title={t('projects.runAllTitle')}>
                    {t('projects.runAllPipelines')}
                  </button>
                )}
              </div>
              {assigned.length > 0 && (
                <div className="td-pipes-list">
                  {assigned.map((p) => {
                    const gates = p.steps.filter((s) => s.mode === StepMode.Gate).length;
                    return (
                      <div className="td-pipe" key={p.id}>
                        <span className="td-pipe-ico"><PipelinesIcon width={14} height={14} /></span>
                        <div className="td-pipe-id">
                          <div className="td-pipe-name">{p.name}</div>
                          <div className="td-pipe-meta">
                            {t('projects.stepCount', { count: p.steps.length })}
                            {gates > 0 ? ` · ${t('tasks.gateCount', { count: gates })}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="td-pipe-run"
                          disabled={busy || p.steps.length === 0}
                          title={p.steps.length === 0 ? t('projects.addStepsFirst') : t('projects.runNamedTitle', { name: p.name })}
                          aria-label={t('projects.runNamed', { name: p.name })}
                          onClick={() => runPipeline(p)}
                        >
                          <PlayIcon width={11} height={11} />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="td-pipe-del"
                            disabled={busy}
                            title={t('projects.removeFromProject', { name: p.name })}
                            aria-label={t('projects.remove')}
                            onClick={() => void detachPipeline(p.id)}
                          >
                            <XIcon width={11} height={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {canEdit && unassigned.length > 0 && (
                <div className="td-assign-wrap">
                  <button type="button" className="td-assign" disabled={busy} onClick={() => setAdding((s) => !s)}>
                    <PlusIcon width={13} height={13} /> {t('projects.addPipeline')}
                  </button>
                  {adding && (
                    <div className="lin-menu td-assign-menu">
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

              {canEdit && (
                <>
                  <div className="td-side-sep" />
                  <button
                    type="button"
                    className="btn-ghost btn-inline"
                    onClick={() => navigate(`/projects/${projectId}/tasks/${taskId}/edit`)}
                  >
                    <PencilIcon width={14} height={14} /> {t('common.edit')}
                  </button>
                </>
              )}

              <div className="td-side-sep" />
              <div className="td-meta">
                {t('projects.createdByOn', { date: fmtDate(task.createdAt), name: task.createdBy.name })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </EditorShell>
  );
}
