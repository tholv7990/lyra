import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  canEditProject,
  ProjectVisibility,
  STEP_DEFS,
  STEP_PROVIDERS,
  StepMode,
  StepStatus,
  type ApiKeyInfo,
  type Project,
  type Run,
  type Step,
} from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  waiting: 'Awaiting approval',
  done: 'Done',
  error: 'Error',
};

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  [ProjectVisibility.Private]: 'Private',
  [ProjectVisibility.Shared]: 'Shared',
  [ProjectVisibility.Workspace]: 'Workspace',
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [keysSet, setKeysSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await api<Project>(`/projects/${id}`);
      setProject(p);
      const [runs, keys] = await Promise.all([
        api<Run[]>(`/projects/${id}/runs`),
        api<ApiKeyInfo[]>(`/workspaces/${p.workspaceId}/keys`),
      ]);
      setRun(runs[0] ?? null);
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

  const startRun = () =>
    act(async () => setRun(await api<Run>(`/projects/${id}/runs`, { method: 'POST' })));
  const runAll = () =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/run-all`, { method: 'POST' })));
  const stop = () =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/stop`, { method: 'POST' })));
  const reset = () =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/reset`, { method: 'POST' })));
  const runStep = (i: number) =>
    run && act(async () => setRun(await api<Run>(`/runs/${run.id}/steps/${i}/run`, { method: 'POST' })));
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

  const changeVisibility = (visibility: ProjectVisibility) => {
    if (!project) return;
    const pid = project.id;
    return act(async () =>
      setProject(
        await api<Project>(`/projects/${pid}`, {
          method: 'PATCH',
          body: JSON.stringify({ visibility }),
        }),
      ),
    );
  };

  if (loading) return <p className="empty">Loading…</p>;
  if (!project) return <p className="empty">{error ?? 'Project not found.'}</p>;

  const canEdit =
    !!user &&
    !!current &&
    project.workspaceId === current.id &&
    canEditProject(project, {
      userId: user.id,
      role: current.role,
      canManageKeys: current.canManageKeys,
    });

  return (
    <div>
      <div className="section-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {project.name}
            <span className={`badge vis-${project.visibility}`}>{VISIBILITY_LABELS[project.visibility]}</span>
          </h2>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
            <Link to="/projects" style={{ color: 'var(--primary)' }}>← Back to projects</Link>
          </p>
        </div>
        <div className="run-controls">
          {!run ? (
            <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={startRun}>
              Start run
            </button>
          ) : (
            <>
              <span className={`badge status-${run.status}`}>{STATUS_LABEL[run.status] ?? run.status}</span>
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy || run.status === 'done'} onClick={runAll}>
                Run all
              </button>
              <button className="btn-ghost" disabled={busy || run.status !== 'running'} onClick={stop}>Stop</button>
              <button className="btn-ghost" disabled={busy} onClick={reset}>Reset</button>
              <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={startRun}>
                New run
              </button>
            </>
          )}
        </div>
      </div>

      <div className="detail-panel">
        <div className="detail-grid">
          <div className="detail-field">
            <div className="label">Visibility</div>
            <div className="value">
              {canEdit ? (
                <select
                  className="text-input select-sm"
                  value={project.visibility}
                  onChange={(e) => void changeVisibility(e.target.value as ProjectVisibility)}
                >
                  {Object.values(ProjectVisibility).map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              ) : (
                <span className={`badge vis-${project.visibility}`}>{VISIBILITY_LABELS[project.visibility]}</span>
              )}
            </div>
          </div>
          <div className="detail-field">
            <div className="label">Product</div>
            <div className="value">{project.product || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="label">Niche</div>
            <div className="value">{project.niche || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="label">Homepage</div>
            <div className="value">
              {project.homepageUrl ? (
                <a href={project.homepageUrl} target="_blank" rel="noreferrer">{project.homepageUrl}</a>
              ) : (
                '—'
              )}
            </div>
          </div>
          <div className="detail-field">
            <div className="label">Created</div>
            <div className="value">{new Date(project.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!run ? (
        <p className="empty">No run yet. Start a run to populate the 8-step workbench.</p>
      ) : (
        <div className="steps">
          {run.steps.map((step) => (
            <StepCard
              key={step.index}
              step={step}
              title={STEP_DEFS[step.index]?.title ?? step.key}
              isCurrent={step.index === run.currentStep && run.status !== 'done'}
              locked={!keysSet.has(STEP_PROVIDERS[step.key])}
              provider={STEP_PROVIDERS[step.key]}
              busy={busy}
              onRun={() => runStep(step.index)}
              onApprove={() => approve(step.index)}
              onSavePrompt={(p) => savePrompt(step.index, p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepCard(props: {
  step: Step;
  title: string;
  isCurrent: boolean;
  locked: boolean;
  provider: string;
  busy: boolean;
  onRun: () => void;
  onApprove: () => void;
  onSavePrompt: (prompt: string) => void;
}) {
  const { step, title, isCurrent, locked, provider, busy } = props;
  const [draft, setDraft] = useState(step.prompt);
  useEffect(() => setDraft(step.prompt), [step.prompt]);
  const dirty = draft !== step.prompt;
  const isGate = step.mode === StepMode.Gate;

  return (
    <div className={`step ${isCurrent ? 'current' : ''} ${step.status === StepStatus.Done ? 'is-done' : ''}`}>
      <div className="step-head">
        <span className="step-num">{step.index + 1}</span>
        <span className="step-title">{title}</span>
        <span className={`mode-tag ${isGate ? 'gate' : 'auto'}`}>{isGate ? 'GATE' : 'AUTO'}</span>
        <span className="step-model">{step.model}</span>
        <span className={`badge status-${step.status}`} style={{ marginLeft: 'auto' }}>
          {STATUS_LABEL[step.status] ?? step.status}
        </span>
      </div>

      <textarea
        className="text-input prompt-area"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="step-actions">
        {dirty && (
          <button className="btn-ghost" disabled={busy} onClick={() => props.onSavePrompt(draft)}>
            Save prompt
          </button>
        )}
        {locked ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Locked — set the <strong>{provider}</strong> key in{' '}
            <Link to="/settings" style={{ color: 'var(--primary)' }}>Settings</Link>
          </span>
        ) : step.status === StepStatus.Waiting ? (
          <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={props.onApprove}>
            Approve gate
          </button>
        ) : isCurrent && step.status !== StepStatus.Done ? (
          <button className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy} onClick={props.onRun}>
            Run step
          </button>
        ) : null}
      </div>

      {step.result && <pre className="result-box">{step.result}</pre>}
    </div>
  );
}
