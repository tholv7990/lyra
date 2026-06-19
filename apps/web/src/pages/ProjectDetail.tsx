import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  providerNeedsKey,
  keyProviderFor,
  ProjectStatus,
  StepMode,
  StepStatus,
  type ApiKeyInfo,
  type Asset,
  type Pipeline,
  type Project,
  type Provider,
  type Run,
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

const PROJECT_STATUS_KEY: Record<ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'projects.statusDraft',
  [ProjectStatus.Public]: 'projects.statusPublic',
};

// Distinct collection names the pipeline's fan-out steps map over.
function fanOutNames(p: Pipeline): string[] {
  return [...new Set(p.steps.filter((s) => s.fanOut?.over).map((s) => s.fanOut!.over))];
}

export function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
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
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [closedPipes, setClosedPipes] = useState<Set<string>>(new Set());
  const togglePipe = (pid: string) =>
    setClosedPipes((s) => {
      const n = new Set(s);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  const [library, setLibrary] = useState<Pipeline[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [runAssets, setRunAssets] = useState<Asset[]>([]);
  const [runView, setRunView] = useState(false); // focused run view vs dashboard
  useBreadcrumb(runView && run ? run.pipelineName ?? project?.name ?? '…' : project?.name ?? '…');
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [askVarsFor, setAskVarsFor] = useState<Pipeline | null>(null);
  const [adding, setAdding] = useState(false); // attach-pipeline picker open
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await api<Project>(`/projects/${id}`);
      setProject(p);
      const [lib, rs, keys] = await Promise.all([
        api<Pipeline[]>(`/workspaces/${p.workspaceId}/pipelines`),
        api<Run[]>(`/projects/${id}/runs`),
        api<ApiKeyInfo[]>(`/workspaces/${p.workspaceId}/keys`),
      ]);
      setLibrary(lib);
      setRuns(rs);
      setKeysSet(new Set(keys.map((k) => k.provider)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!project) return;
    setNameDraft(project.name);
    setDescriptionDraft(project.description ?? '');
  }, [project?.id, project?.name, project?.description]);

  // Load the run's media whenever the run changes (e.g. after a step renders).
  useEffect(() => {
    if (!run) {
      setRunAssets([]);
      return;
    }
    let cancelled = false;
    api<Asset[]>(`/runs/${run.id}/assets`)
      .then((a) => !cancelled && setRunAssets(a))
      .catch(() => !cancelled && setRunAssets([]));
    return () => {
      cancelled = true;
    };
  }, [run]);

  // Per-run result history for a step: the same step (by index) across prior
  // runs of this pipeline in this project, newest first. Matched by name when
  // both have one (guards against misalignment if the pipeline was edited).
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

  async function saveProjectMeta(patch: Partial<Pick<Project, 'name' | 'description'>>) {
    if (!id || !project || !canEdit || savingMeta) return;
    setSavingMeta(true);
    setError(null);
    try {
      const updated = await api<Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.saveFailed'));
      setNameDraft(project.name);
      setDescriptionDraft(project.description ?? '');
    } finally {
      setSavingMeta(false);
    }
  }

  const commitName = () => {
    if (!project) return;
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(project.name);
      return;
    }
    if (next !== project.name) void saveProjectMeta({ name: next });
  };

  const commitDescription = () => {
    if (!project) return;
    if (descriptionDraft !== (project.description ?? '')) {
      void saveProjectMeta({ description: descriptionDraft });
    }
  };

  const canEdit =
    !!user &&
    !!current &&
    !!project &&
    project.workspaceId === current.id &&
    canEditProject(
      { createdBy: project.createdBy.id },
      { userId: user.id, role: current.role, canManageKeys: current.canManageKeys },
    );

  // The project's pipelines, resolved from the id refs against the workspace
  // library (soft-deleted/unknown ids are dropped). `unassigned` feeds the picker.
  const byId = useMemo(() => new Map(library.map((p) => [p.id, p])), [library]);
  const assigned = useMemo(
    () => (project?.pipelines ?? []).map((pid) => byId.get(pid)).filter((p): p is Pipeline => !!p),
    [project, byId],
  );
  const unassigned = useMemo(
    () => library.filter((p) => !(project?.pipelines ?? []).includes(p.id)),
    [project, library],
  );

  const projectVars = useMemo(
    () => Object.fromEntries((project?.variables ?? []).map((v) => [v.key, v.value])),
    [project],
  );

  const savePipelines = (ids: string[]) =>
    act(async () => {
      const updated = await api<Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pipelines: ids }),
      });
      setProject(updated);
    });
  const attachPipeline = (pid: string) => {
    setAdding(false);
    return savePipelines([...(project?.pipelines ?? []), pid]);
  };
  const detachPipeline = (pid: string) =>
    savePipelines((project?.pipelines ?? []).filter((x) => x !== pid));

  // Start a run and jump into the focused run view.
  const startRun = (
    pipelineId: string,
    values: Record<string, string>,
    collections: Record<string, string[]> = {},
  ) =>
    act(async () => {
      const created = await api<Run>(`/projects/${id}/pipelines/${pipelineId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ variables: values, collections }),
      });
      setRun(created);
      setRuns((r) => [created, ...r]);
      setRunView(true);
      setAskVarsFor(null);
    });

  // Ask for values first when the pipeline declares variables OR fans out over a
  // collection; otherwise run straight away.
  const runPipeline = (pipeline: Pipeline) => {
    if (pipeline.variables.length > 0 || fanOutNames(pipeline).length > 0) setAskVarsFor(pipeline);
    else void startRun(pipeline.id, {});
  };

  // Composition: launch every assigned pipeline at once, each in the project's
  // context. Pipelines needing per-run inputs use defaults — run them individually
  // for custom variables / fan-out items.
  const runAllPipelines = () =>
    act(async () => {
      const created = await api<Run[]>(`/projects/${id}/runs/all`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (created.length > 0) setRuns((r) => [...created, ...r]);
    });

  const openRun = (r: Run) => {
    setRun(r);
    setRunView(true);
  };

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

  if (loading) return <p className="empty">{t('common.loading')}</p>;
  if (!project) return <p className="empty">{error ?? t('projects.notFound')}</p>;

  return (
    <EditorShell
      wide
      onBack={() => navigate('/projects')}
      title={
        // Desktop: the breadcrumb already shows the name — don't repeat it (the empty
        // header bar is hidden via CSS). On mobile the breadcrumb is hidden, so the
        // title (and the ‹ back) live here.
        isMobile ? (
          <h2 className="eshell-name">{runView && run ? run.pipelineName ?? t('projects.runFallback') : project.name}</h2>
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
              <span className="run-bar-proj"><strong>{run.pipelineName ?? t('projects.runFallback')}</strong></span>
              <span className={`badge status-${run.status}`}>{statusLabel(run.status)}</span>
              {run.steps.some((s) => s.status === StepStatus.Done) && (
                <RunRating value={run.rating} disabled={busy} onRate={rate} />
              )}
              <div className="run-view-actions">
                <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy || run.status === 'done'} onClick={runAll}>
                  {t('run.runAll')}
                </button>
                <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy || run.status !== 'running'} onClick={stop}>
                  {t('run.stop')}
                </button>
                <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={reset}>
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
          /* ---- Dashboard ---- */
          <>
            <div className="proj-head">
              <div className="proj-title-row">
                {canEdit ? (
                  <input
                    className="proj-title-input"
                    value={nameDraft}
                    disabled={savingMeta}
                    aria-label={t('projects.namePlaceholder')}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === 'Escape') {
                        setNameDraft(project.name);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <h1 className="proj-title-static">{project.name}</h1>
                )}
              </div>
              <div className="proj-desc-row">
                {canEdit ? (
                  <textarea
                    className="proj-desc-input"
                    value={descriptionDraft}
                    disabled={savingMeta}
                    rows={2}
                    placeholder={t('projects.descriptionPlaceholder')}
                    aria-label={t('projects.descriptionLabel')}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onBlur={commitDescription}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setDescriptionDraft(project.description ?? '');
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <p className="proj-product">{project.description || t('projects.noDescription')}</p>
                )}
              </div>
              <div className="proj-meta">
                <span className={`badge status-${project.status}`}>{t(PROJECT_STATUS_KEY[project.status])}</span>
                <span className="proj-summary-item">
                  <strong>{assigned.length}</strong>
                  {t('projects.pipelineCount', { count: assigned.length })}
                </span>
                <span className="proj-summary-item">
                  <strong>{project.variables.length}</strong>
                  {t('projects.variableCount', { count: project.variables.length })}
                </span>
                <span className="proj-summary-user" title={t('projects.createdByName', { name: project.createdBy.name })}>
                  <span className="prow-updated-icon" style={avatarStyle(project.createdBy.name)} aria-hidden="true">
                    {initial(project.createdBy.name)}
                  </span>
                </span>
                <span className="dot">·</span>
                <span>
                  {t('projects.createdByOn', {
                    date: fmtDate(project.createdAt),
                    name: project.createdBy.name,
                  })}
                </span>
              </div>
            </div>

            <div className="proj-vars-panel">
              <div className="proj-vars-title">{t('projects.variablesLabel')}</div>
            {project.variables.length > 0 && (
              <div className="proj-vars-view">
                {project.variables.map((v) => (
                  <span className="proj-var-chip" key={v.key}>
                    <code>{`{${v.key}}`}</code>
                    <span className="proj-var-val">{v.value || '—'}</span>
                  </span>
                ))}
              </div>
            )}
              {project.variables.length === 0 && (
                <p className="proj-vars-empty-view">{t('projects.noVariables')}</p>
              )}
              {canEdit && (
                <Link className="txt-btn proj-vars-edit" to={`/projects/${project.id}/edit`}>
                  {t('projects.editVariables')}
                </Link>
              )}
            </div>

            {error && <p className="error">{error}</p>}

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
            </div>
            {assigned.length === 0 ? (
              <div className="prompt-empty">
                <h3>{t('projects.noPipelinesTitle')}</h3>
                <p>
                  {library.length === 0 ? (
                    <>
                      {t('projects.noPipelinesCreatePre')}{' '}
                      <Link to="/pipelines" style={{ color: 'var(--primary)' }}>{t('projects.pipelines')}</Link>{' '}
                      {t('projects.noPipelinesCreatePost')}
                    </>
                  ) : canEdit ? (
                    <>{t('projects.noPipelinesAddPre')} <strong>{t('projects.addPipeline')}</strong> {t('projects.noPipelinesAddPost')}</>
                  ) : (
                    <>{t('projects.noPipelinesViewer')}</>
                  )}
                </p>
                {library.length === 0 && (
                  <Link className="btn-primary" to="/pipelines" style={{ width: 'auto' }}>
                    {t('projects.goToPipelines')}
                  </Link>
                )}
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
