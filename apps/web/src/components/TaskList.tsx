import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Task } from '@lyra/shared';
import { api } from '../lib/api';
import { initial, avatarStyle } from '../lib/format';
import { TASK_STATUS_ORDER, TASK_STATUS_COLOR, groupTasksByStatus } from '../lib/taskStatus';
import { PlusIcon } from '../layout/icons';

// The project's tasks, grouped under status section headers (Linear-style list).
// Empty status groups are hidden so the page never shows blank columns. A row
// opens the task-detail run workbench. Editors can add a task (lands in New).
export function TaskList({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Task[]>(`/projects/${projectId}/tasks`)
      .then((list) => {
        if (cancelled) return;
        setTasks(list);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : t('tasks.loadFailed')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  async function addTask() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const created = await api<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ name: n }),
      });
      setTasks((ts) => [created, ...ts]);
      setName('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tasks.addFailed'));
    } finally {
      setBusy(false);
    }
  }

  const grouped = groupTasksByStatus(tasks);
  const groups = TASK_STATUS_ORDER.filter((s) => grouped[s].length > 0);

  return (
    <section className="tlist">
      <div className="tlist-head">
        <h2>{t('tasks.heading')}</h2>
        {canEdit && !adding && (
          <button className="btn-ghost btn-inline tlist-add" onClick={() => setAdding(true)}>
            <PlusIcon width={14} height={14} /> {t('tasks.add')}
          </button>
        )}
      </div>

      {canEdit && adding && (
        <form
          className="tlist-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder={t('tasks.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAdding(false);
                setName('');
              }
            }}
          />
          <button type="submit" className="btn-primary btn-inline" disabled={busy || !name.trim()}>
            {t('tasks.add')}
          </button>
          <button
            type="button"
            className="btn-ghost btn-inline"
            onClick={() => {
              setAdding(false);
              setName('');
            }}
          >
            {t('tasks.cancel')}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="tlist-skel" aria-hidden="true">
          {[68, 52, 60, 44].map((w, i) => (
            <div className="trow trow-skel" key={i}>
              <span className="skel-line" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="prompt-empty">
          <h3>{t('tasks.emptyTitle')}</h3>
          <p>{t('tasks.empty')}</p>
          {canEdit && !adding && (
            <button className="btn-primary btn-inline" onClick={() => setAdding(true)}>
              {t('tasks.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="tgroups">
          {groups.map((s) => (
            <div className="tgroup" key={s}>
              <div className="tgroup-head">
                <span className="tgroup-dot" style={{ background: TASK_STATUS_COLOR[s] }} aria-hidden="true" />
                <span className="tgroup-name">{t(`tasks.status.${s}`)}</span>
                <span className="tgroup-count">{grouped[s].length}</span>
              </div>
              <ul className="tgroup-rows">
                {grouped[s].map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="trow"
                      onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                    >
                      <span className="trow-name">{task.name}</span>
                      <span className="trow-meta">
                        {task.assignee && (
                          <span className="trow-avatar" style={avatarStyle(task.assignee.name)} title={task.assignee.name}>
                            {initial(task.assignee.name)}
                          </span>
                        )}
                        <span className="trow-pipes">{t('tasks.pipelineCount', { count: task.pipelines.length })}</span>
                        <span className="trow-chev" aria-hidden="true">›</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
