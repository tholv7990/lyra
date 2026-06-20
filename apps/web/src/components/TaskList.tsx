import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TaskPriority, TaskStatus, labelColor, type Task, type LabelInfo } from '@lyra/shared';
import { api } from '../lib/api';
import { initials } from '../lib/format';
import { TASK_STATUS_ORDER, groupTasksByStatus } from '../lib/taskStatus';
import { TaskStatusIcon } from './TaskStatusIcon';
import { TaskPriorityIcon } from './TaskPriorityIcon';
import { PlusIcon } from '../layout/icons';
import './tasks.css';

// The project's task board (design): a horizontal row of status columns
// (New · In progress · On hold · Complete), each a scrollable stack of task
// cards. A card opens the task-detail run workbench. Editors can add a task to
// any column (it's created, then moved if the column isn't New). The page-header
// "New task" button opens the New-column composer via `openAddTick`.
export function TaskList({
  projectId,
  canEdit,
  labels,
  openAddTick = 0,
}: {
  projectId: string;
  canEdit: boolean;
  labels: LabelInfo[];
  openAddTick?: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState<TaskStatus | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Task[]>(`/projects/${projectId}/tasks`)
      .then((list) => { if (!cancelled) { setTasks(list); setError(null); } })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : t('tasks.loadFailed')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectId, t]);

  // Page-header "New task" → open the New column's composer.
  useEffect(() => {
    if (openAddTick) { setAddingCol(TaskStatus.New); setName(''); }
  }, [openAddTick]);

  async function addTask(status: TaskStatus) {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      // The create endpoint always lands a task in New; move it if needed.
      let created = await api<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ name: n }),
      });
      if (status !== TaskStatus.New) {
        created = await api<Task>(`/projects/${projectId}/tasks/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      setTasks((ts) => [created, ...ts]);
      setName('');
      setAddingCol(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tasks.addFailed'));
    } finally {
      setBusy(false);
    }
  }

  const grouped = groupTasksByStatus(tasks);

  if (loading) {
    return (
      <div className="tboard" aria-hidden="true">
        <div className="tboard-cols">
          {TASK_STATUS_ORDER.map((s) => (
            <div className="tcol" key={s}>
              <div className="tcol-head">
                <TaskStatusIcon status={s} size={14} />
                <span className="tcol-name">{t(`tasks.status.${s}`)}</span>
              </div>
              <div className="tcol-body">
                <div className="tcard"><span className="skel-line" style={{ width: '70%' }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="tboard">
      <div className="tboard-cols">
        {TASK_STATUS_ORDER.map((s) => (
          <div className="tcol" key={s}>
            <div className="tcol-head">
              <TaskStatusIcon status={s} size={14} />
              <span className="tcol-name">{t(`tasks.status.${s}`)}</span>
              <span className="tcol-count">{grouped[s].length}</span>
              <div style={{ flex: 1 }} />
              {canEdit && (
                <button
                  type="button"
                  className="tcol-add"
                  title={t('tasks.add')}
                  aria-label={t('tasks.add')}
                  onClick={() => { setAddingCol(s); setName(''); }}
                >
                  <PlusIcon width={14} height={14} />
                </button>
              )}
            </div>
            <div className="tcol-body">
              {grouped[s].map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="tcard"
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                >
                  <div className="tcard-top">
                    <TaskStatusIcon status={task.status} size={15} />
                    <span className="tcard-name">{task.name}</span>
                  </div>
                  {task.tags.length > 0 && (
                    <div className="tcard-tags">
                      {task.tags.map((name) => (
                        <span className="tag-chip" key={name}>
                          <span className="tdot" style={{ background: labelColor(name, labels) }} />
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="tcard-foot">
                    <div className="tcard-foot-l">
                      <span className="tcard-pipes" title={t('tasks.pipelineCount', { count: task.pipelines.length })}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="8" r="1.5" /><path d="M5.5 4H8a2 2 0 0 1 2 2v.3M5.5 12H8a2 2 0 0 0 2-2v-.3" /></svg>
                        {task.pipelines.length}
                      </span>
                    </div>
                    <div className="tcard-foot-r">
                      {task.priority !== TaskPriority.None && <TaskPriorityIcon priority={task.priority} size={15} />}
                      {task.assignee && (
                        <span className="tcard-avatar" style={{ background: labelColor(task.assignee.name, []) }} title={task.assignee.name}>
                          {initials(task.assignee.name)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {canEdit && addingCol === s ? (
                <form
                  className="tcol-addform"
                  onSubmit={(e) => { e.preventDefault(); void addTask(s); }}
                >
                  <input
                    className="text-input"
                    autoFocus
                    placeholder={t('tasks.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setAddingCol(null); setName(''); } }}
                  />
                  <div className="tcol-addform-actions">
                    <button type="submit" className="btn-primary btn-inline btn-sm" disabled={busy || !name.trim()}>
                      {t('tasks.add')}
                    </button>
                    <button type="button" className="btn-ghost btn-inline btn-sm" onClick={() => { setAddingCol(null); setName(''); }}>
                      {t('tasks.cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                canEdit && (
                  <button type="button" className="tcol-addrow" onClick={() => { setAddingCol(s); setName(''); }}>
                    <PlusIcon width={13} height={13} /> {t('tasks.add')}
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
