import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Task } from '@lyra/shared';
import { api } from '../lib/api';
import { initial, avatarStyle } from '../lib/format';
import { TASK_STATUS_ORDER, TASK_STATUS_COLOR, groupTasksByStatus } from '../lib/taskStatus';
import { PlusIcon } from '../layout/icons';

// The project board: tasks grouped into status columns. A task card opens the
// task-detail run workbench. Editors can add a task (name only; it lands in New).
export function TaskBoard({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
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

  return (
    <div className="task-board">
      <div className="task-board-head">
        <h2>{t('tasks.heading')}</h2>
        {canEdit &&
          (adding ? (
            <form
              className="task-add"
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
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto', marginTop: 0 }} disabled={busy || !name.trim()}>
                {t('tasks.add')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: 'auto', marginTop: 0 }}
                onClick={() => {
                  setAdding(false);
                  setName('');
                }}
              >
                {t('tasks.cancel')}
              </button>
            </form>
          ) : (
            <button className="btn-ghost task-add-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => setAdding(true)}>
              <PlusIcon width={14} height={14} /> {t('tasks.add')}
            </button>
          ))}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t('tasks.loading')}</p>
      ) : tasks.length === 0 ? (
        <p className="empty">{t('tasks.empty')}</p>
      ) : (
        <div className="task-cols">
          {TASK_STATUS_ORDER.map((s) => (
            <div className="task-col" key={s}>
              <div className="task-col-head">
                <span className="task-col-dot" style={{ background: TASK_STATUS_COLOR[s] }} aria-hidden="true" />
                {t(`tasks.status.${s}`)}
                <span className="task-col-count">{grouped[s].length}</span>
              </div>
              <div className="task-col-body">
                {grouped[s].map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="task-card"
                    onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                  >
                    <span className="task-card-name">{task.name}</span>
                    <div className="task-card-foot">
                      {task.assignee && (
                        <span className="task-card-avatar" style={avatarStyle(task.assignee.name)} title={task.assignee.name}>
                          {initial(task.assignee.name)}
                        </span>
                      )}
                      <span className="task-card-pipes">{t('tasks.pipelineCount', { count: task.pipelines.length })}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
