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
import { useIsMobile } from '../lib/useIsMobile';
import { useModels } from '../lib/useModels';
import { previewRunProgress } from '../lib/useRunActions';
import { EditorShell } from '../components/EditorShell';
import { RunFlow } from '../components/RunFlow';
import { RunRating } from '../components/RunRating';
import type { StepHistoryEntry } from '../components/StepResultModal';
import { RunSummary } from '../components/RunSummary';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { ProviderIcon } from '../components/ProviderIcon';
import { useBreadcrumb } from '../layout/breadcrumb';

// Suppress unused import warning — fmtDate used in future task timeline
void fmtDate;
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
  const { catalog } = useModels(wsId);
  const isMobile = useIsMobile();
  const modelLabel = (p: Provider, m: string) => catalog[p]?.find((o) => o.id === m)?.label ?? m;

  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [taskNameDraft, setTaskNameDraft] = useState('');
  const [taskDescDraft, setTaskDescDraft] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [closedPipes, setClosedPipes] = useState<Set<string>>(new Set());
  const togglePipe = (pid: string) =>
    setClosedPipes((s) => {
      const n = new Set(s);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
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
    if (!task) return;
    setTaskNameDraft(task.name);
    setTaskDescDraft(task.description ?? '');
  }, [task?.id, task?.name, task?.description]);

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
    assigneeId?: string | null;
    pipelines?: string[];
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
      if (task) {
        setTaskNameDraft(task.name);
        setTaskDescDraft(task.description ?? '');
      }
    } finally {
      setSavingTask(false);
    }
  }

  const commitTaskName = () => {
    if (!task) return;
    const next = taskNameDraft.trim();
    if (!next) { setTaskNameDraft(task.name); return; }
    if (next !== task.name) void patchTask({ name: next });
  };

  const commitTaskDesc = () => {
    if (!task) return;
    if (taskDescDraft !== (task.description ?? '')) void patchTask({ description: taskDescDraft });
  };

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
  const TASK_STATUS_VALUES = Object.values(TaskStatus);

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!task || !project) return <p className="empty">{error ?? t('tasks.loadFailed')}</p>;

  return (
    <EditorShell
      wide
      onBack={() => navigate(`/projects/${projectId}`)}
      title={
        isMobile ? (
          <h2 className="eshell-name">
            {runView && run ? run.pipelineName ?? t('projects.runFallback') : task.name}
          </h2>
        ) : (
          <span className="eshell-spacer" aria-hidden />
        )
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
                  className="btn-primary"
                  style={{ width: 'auto', marginTop: 0 }}
                  disabled={busy || run.status === 'done'}
                  onClick={runAll}
                >
                  {t('run.runAll')}
                </button>
                <button
                  className="btn-ghost"
                  style={{ width: 'auto', marginTop: 0 }}
                  disabled={busy || run.status !== 'running'}
                  onClick={stop}
                >
                  {t('run.stop')}
                </button>
                <button
                  className="btn-ghost"
                  style={{ width: 'auto', marginTop: 0 }}
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
          /* ---- Task dashboard ---- */
          <>
            {/* Task header */}
            <div className="proj-head">
              <div className="proj-title-row">
                {canEdit ? (
                  <input
                    className="proj-title-input"
                    value={taskNameDraft}
                    disabled={savingTask}
                    aria-label={t('tasks.namePlaceholder')}
                    onChange={(e) => setTaskNameDraft(e.target.value)}
                    onBlur={commitTaskName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                      if (e.key === 'Escape') { setTaskNameDraft(task.name); e.currentTarget.blur(); }
                    }}
                  />
                ) : (
                  <h1 className="proj-title-static">{task.name}</h1>
                )}
                {/* Status dropdown */}
                <select
                  className="task-status-select"
                  value={task.status}
                  disabled={!canEdit || savingTask}
                  aria-label={t('tasks.statusLabel')}
                  onChange={(e) => void patchTask({ status: e.target.value as TaskStatus })}
                >
                  {TASK_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>{t(`tasks.status.${s}`)}</option>
                  ))}
                </select>
                {/* Assignee picker — hidden for personal workspaces */}
                {!isPersonal && (
                  <div className="task-assignee-wrap">
                    <button
                      className="btn-ghost task-assignee-btn"
                      style={{ width: 'auto', marginTop: 0 }}
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
                )}
              </div>
              <div className="proj-desc-row">
                {canEdit ? (
                  <textarea
                    className="proj-desc-input"
                    value={taskDescDraft}
                    disabled={savingTask}
                    rows={2}
                    placeholder={t('tasks.descriptionPlaceholder')}
                    aria-label={t('tasks.descriptionPlaceholder')}
                    onChange={(e) => setTaskDescDraft(e.target.value)}
                    onBlur={commitTaskDesc}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setTaskDescDraft(task.description ?? ''); e.currentTarget.blur(); }
                    }}
                  />
                ) : (
                  <p className="proj-product">{task.description || t('tasks.descriptionPlaceholder')}</p>
                )}
              </div>
            </div>

            {error && <p className="error">{error}</p>}

            {/* Pipelines section */}
            <div className="section-head proj-sec">
              <h2>{t('projects.pipelines')}</h2>
              <div className="proj-sec-actions">
                {assigned.length > 0 && (
                  <button
                    className="btn-ghost"
                    style={{ width: 'auto', marginTop: 0 }}
                    disabled={busy}
                    onClick={runAllPipelines}
                    title={t('projects.runAllTitle')}
                  >
                    {t('projects.runAllPipelines')}
                  </button>
                )}
                {canEdit && unassigned.length > 0 && (
                  <div className="proj-add-pipe">
                    <button
                      className="btn-ghost"
                      style={{ width: 'auto', marginTop: 0 }}
                      disabled={busy}
                      onClick={() => setAdding((s) => !s)}
                    >
                      {t('projects.addPipeline')}
                    </button>
                    {adding && (
                      <div className="lin-menu proj-add-menu">
                        {unassigned.map((p) => (
                          <button
                            key={p.id}
                            className="lin-menu-item"
                            disabled={busy}
                            onClick={() => void attachPipeline(p.id)}
                          >
                            {p.name}
                            <span className="lin-menu-count">{t('projects.stepCount', { count: p.steps.length })}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
              <div className="list">
                {assigned.map((p) => {
                  const open = !closedPipes.has(p.id);
                  return (
                    <div className={`pipe-card${open ? ' open' : ''}`} key={p.id}>
                      <div
                        className="pipe-head"
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePipe(p.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePipe(p.id); } }}
                      >
                        <span className="pipe-chev" aria-hidden>{open ? '▾' : '▸'}</span>
                        <div className="grow">
                          <div className="title">{p.name}</div>
                          <div className="sub">
                            {t('projects.stepCount', { count: p.steps.length })}
                            {p.description ? ` · ${p.description}` : ''}
                          </div>
                        </div>
                        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              className="txt-btn danger"
                              disabled={busy}
                              title={t('projects.removeFromProject', { name: p.name })}
                              onClick={() => void detachPipeline(p.id)}
                            >
                              {t('projects.remove')}
                            </button>
                          )}
                          <button
                            className="btn-primary"
                            style={{ width: 'auto', marginTop: 0 }}
                            disabled={busy || p.steps.length === 0}
                            title={p.steps.length === 0 ? t('projects.addStepsFirst') : t('projects.runNamedTitle', { name: p.name })}
                            onClick={() => runPipeline(p)}
                          >
                            {t('projects.runPipeline')}
                          </button>
                        </span>
                      </div>
                      {open && (
                        <div className="pipe-steps">
                          {p.steps.length === 0 ? (
                            <p className="muted pipe-empty">{t('projects.noStepsShort')}</p>
                          ) : (
                            p.steps.map((s, i) => (
                              <div className="pipe-step" key={s.id}>
                                <span className="pipe-step-n">{i + 1}</span>
                                <span className="pipe-step-name">{s.name}</span>
                                <span className="pipe-step-model">
                                  <ProviderIcon provider={s.provider} size={14} />
                                  {modelLabel(s.provider, s.model)}
                                </span>
                                <span className={`mode-tag ${s.mode === StepMode.Gate ? 'gate' : 'auto'}`}>
                                  {s.mode === StepMode.Gate ? t('run.gate') : t('run.auto')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
          </>
        )}
      </div>
    </EditorShell>
  );
}
