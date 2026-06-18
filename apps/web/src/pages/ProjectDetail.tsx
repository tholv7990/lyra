import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  canEditProject,
  ProjectStatus,
  ProjectShare,
  StepMode,
  type ApiKeyInfo,
  type Asset,
  type Pipeline,
  type Project,
  type Provider,
  type Run,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { useIsMobile } from '../lib/useIsMobile';
import { useModels } from '../lib/useModels';
import { previewRunProgress } from '../lib/useRunActions';
import { EditorShell } from '../components/EditorShell';
import { RunFlow } from '../components/RunFlow';
import { RunSummary } from '../components/RunSummary';
import { RunVariablesModal } from '../components/RunVariablesModal';
import { ProviderIcon } from '../components/ProviderIcon';
import { useBreadcrumb } from '../layout/breadcrumb';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  awaiting_gate: 'Awaiting approval',
  skipped: 'Skipped',
  done: 'Done',
  error: 'Error',
};

function shareLabel(p: Project): string {
  if (p.status !== ProjectStatus.Public) return 'Draft';
  return p.shared === ProjectShare.All ? 'Public · Everyone' : 'Public · Chosen people';
}

// Distinct collection names the pipeline's fan-out steps map over.
function fanOutNames(p: Pipeline): string[] {
  return [...new Set(p.steps.filter((s) => s.fanOut?.over).map((s) => s.fanOut!.over))];
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const { catalog } = useModels(wsId);
  const isMobile = useIsMobile();
  const modelLabel = (p: Provider, m: string) => catalog[p]?.find((o) => o.id === m)?.label ?? m;
  const [project, setProject] = useState<Project | null>(null);
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
      setError(err instanceof Error ? err.message : 'Could not load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function act<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

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

  if (loading) return <p className="empty">Loading…</p>;
  if (!project) return <p className="empty">{error ?? 'Project not found.'}</p>;

  return (
    <EditorShell
      wide
      onBack={() => navigate('/projects')}
      title={
        // Desktop: the breadcrumb already shows the name — don't repeat it (the empty
        // header bar is hidden via CSS). On mobile the breadcrumb is hidden, so the
        // title (and the ‹ back) live here.
        isMobile ? (
          <h2 className="eshell-name">{runView && run ? run.pipelineName ?? 'Run' : project.name}</h2>
        ) : (
          <span className="eshell-spacer" aria-hidden />
        )
      }
    >
      {askVarsFor && (
        <RunVariablesModal
          title={`Run “${askVarsFor.name}”`}
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
                Back to project
              </button>
              <span className="run-bar-proj"><strong>{run.pipelineName ?? 'Run'}</strong></span>
              <span className={`badge status-${run.status}`}>{STATUS_LABEL[run.status] ?? run.status}</span>
              <div className="run-view-actions">
                <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy || run.status === 'done'} onClick={runAll}>
                  Run all
                </button>
                <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy || run.status !== 'running'} onClick={stop}>
                  Stop
                </button>
                <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={reset}>
                  Reset
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {run.steps.length === 0 ? (
              <p className="empty">This pipeline has no steps yet. Add steps in the builder.</p>
            ) : (
              <>
                <RunFlow
                  run={run}
                  busy={busy}
                  hasKey={(p) => keysSet.has(p)}
                  onRunStep={runStep}
                  onApprove={approve}
                  onSavePrompt={savePrompt}
                  mobileLayout="flow"
                  assets={runAssets}
                />
                <RunSummary run={run} busy={busy} onRetry={runStep} />
              </>
            )}
          </div>
        ) : (
          /* ---- Dashboard ---- */
          <>
            <div className="proj-head">
              <div className="proj-head-top">
                <p className="proj-product">
                  {project.description || 'No description yet — add one with Edit.'}
                </p>
                {canEdit && (
                  <Link className="btn-ghost proj-edit" style={{ width: 'auto', marginTop: 0 }} to={`/projects/${project.id}/edit`}>
                    Edit
                  </Link>
                )}
              </div>
              <div className="proj-meta">
                <span className={`badge status-${project.status}`}>{shareLabel(project)}</span>
                <span className="dot">·</span>
                <span>
                  Created {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} by {project.createdBy.name}
                </span>
              </div>
            </div>

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

            {error && <p className="error">{error}</p>}

            <div className="section-head proj-sec">
              <h2>Pipelines</h2>
              <div className="proj-sec-actions">
              {assigned.length > 0 && (
                <button
                  className="btn-ghost"
                  style={{ width: 'auto', marginTop: 0 }}
                  disabled={busy}
                  onClick={runAllPipelines}
                  title="Launch every pipeline on this project, each in its context"
                >
                  ▶ Run all
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
                    + Add pipeline
                  </button>
                  {adding && (
                    <div className="lin-menu proj-add-menu">
                      {unassigned.map((p) => (
                        <button key={p.id} className="lin-menu-item" disabled={busy} onClick={() => void attachPipeline(p.id)}>
                          {p.name}
                          <span className="lin-menu-count">{p.steps.length} step{p.steps.length === 1 ? '' : 's'}</span>
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
                <h3>No pipelines assigned</h3>
                <p>
                  {library.length === 0 ? (
                    <>
                      Create pipelines in the{' '}
                      <Link to="/pipelines" style={{ color: 'var(--primary)' }}>Pipelines</Link>{' '}
                      section, then add them here to run against this project.
                    </>
                  ) : canEdit ? (
                    <>Use <strong>+ Add pipeline</strong> above to attach one of your workspace pipelines.</>
                  ) : (
                    <>No pipelines have been added to this project yet.</>
                  )}
                </p>
                {library.length === 0 && (
                  <Link className="btn-primary" to="/pipelines" style={{ width: 'auto' }}>
                    Go to Pipelines
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
                            {p.steps.length} step{p.steps.length === 1 ? '' : 's'}
                            {p.description ? ` · ${p.description}` : ''}
                          </div>
                        </div>
                        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              className="txt-btn danger"
                              disabled={busy}
                              title={`Remove “${p.name}” from this project`}
                              onClick={() => void detachPipeline(p.id)}
                            >
                              Remove
                            </button>
                          )}
                          <button
                            className="btn-primary"
                            style={{ width: 'auto', marginTop: 0 }}
                            disabled={busy || p.steps.length === 0}
                            title={p.steps.length === 0 ? 'Add steps in the builder first' : `Run “${p.name}”`}
                            onClick={() => runPipeline(p)}
                          >
                            ▶ Run
                          </button>
                        </span>
                      </div>
                      {open && (
                        <div className="pipe-steps">
                          {p.steps.length === 0 ? (
                            <p className="muted pipe-empty">No steps yet.</p>
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
                                  {s.mode === StepMode.Gate ? 'GATE' : 'AUTO'}
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
                  <h2>Recent runs</h2>
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
                        <div className="title">{r.pipelineName ?? 'Run'}</div>
                        <div className="sub">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <span className={`badge status-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="txt-btn" onClick={() => openRun(r)}>Open</button>
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
