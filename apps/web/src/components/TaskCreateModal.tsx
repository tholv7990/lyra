import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TaskPriority,
  TaskStatus,
  WorkspaceType,
  type MemberView,
  type Pipeline,
  type Task,
} from '@lyra/shared';
import { api } from '../lib/api';
import { avatarStyle, initial } from '../lib/format';
import { useWorkspace } from '../workspace/useWorkspace';
import { useLabels } from '../lib/useLabels';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useScrollLock } from '../lib/useScrollLock';
import { TaskStatusPicker } from './TaskStatusPicker';
import { TaskPriorityPicker } from './TaskPriorityPicker';
import { LabelPicker } from './LabelPicker';
import { PipelinesIcon, PlusIcon, XIcon } from '../layout/icons';
import './taskmodal.css';

// The design's "New task" dialog: name + description + property pills
// (status/priority/assignee/labels) + assigned pipelines, created in one shot via
// the extended CreateTaskDto. Opens over the board; on success the board inserts it.
export function TaskCreateModal({
  projectId,
  projectName,
  initialStatus = TaskStatus.New,
  onClose,
  onCreated,
}: {
  projectId: string;
  projectName: string;
  initialStatus?: TaskStatus;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const wsId = current?.id;
  const isPersonal = current?.type === WorkspaceType.Personal;
  const { labels, createLabel } = useLabels(wsId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.None);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [library, setLibrary] = useState<Pipeline[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [pipeOpen, setPipeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigneeRef = useRef<HTMLDivElement>(null);
  const pipeRef = useRef<HTMLDivElement>(null);
  useOutsideClick(assigneeRef, assigneeOpen, () => setAssigneeOpen(false));
  useOutsideClick(pipeRef, pipeOpen, () => setPipeOpen(false));

  useEffect(() => {
    if (!wsId) return;
    if (!isPersonal) api<MemberView[]>(`/workspaces/${wsId}/members`).then(setMembers).catch(() => setMembers([]));
    api<Pipeline[]>(`/workspaces/${wsId}/pipelines`).then(setLibrary).catch(() => setLibrary([]));
  }, [wsId, isPersonal]);

  useEscapeKey(onClose);
  useScrollLock();

  const assignee = members.find((m) => m.userId === assigneeId);
  const assigned = pipelines.map((id) => library.find((p) => p.id === id)).filter((p): p is Pipeline => !!p);
  const available = library.filter((p) => !pipelines.includes(p.id));

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const task = await api<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description,
          status,
          priority,
          ...(assigneeId ? { assigneeId } : {}),
          tags,
          pipelines,
        }),
      });
      onCreated(task);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tasks.addFailed'));
      setBusy(false);
    }
  }

  return (
    <div className="tm-scrim" onClick={onClose}>
      <div className="tm-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="tm-head">
          <div className="tm-head-l">
            <span className="tm-badge">{projectName}</span>
            <span className="tm-kicker">{t('projects.newTask')}</span>
          </div>
          <button type="button" className="tm-close" onClick={onClose} aria-label={t('common.close')}>
            <XIcon width={15} height={15} />
          </button>
        </div>

        <div className="tm-body">
          {error && <p className="error">{error}</p>}

          <input
            className="tm-name"
            autoFocus
            placeholder={t('tasks.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void create(); } }}
          />
          <textarea
            className="tm-desc"
            placeholder={t('tasks.descriptionPlaceholder')}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* property pills */}
          <div className="tm-pills">
            <TaskStatusPicker status={status} onChange={setStatus} />
            <TaskPriorityPicker priority={priority} onChange={setPriority} />
            {!isPersonal && (
              <div className="tm-assignee" ref={assigneeRef}>
                <button type="button" className="btn-ghost task-assignee-btn btn-inline" onClick={() => setAssigneeOpen((o) => !o)}>
                  {assignee ? (
                    <>
                      <span className="prow-updated-icon" style={avatarStyle(assignee.name)} aria-hidden="true">{initial(assignee.name)}</span>
                      {assignee.name}
                    </>
                  ) : t('tasks.unassigned')}
                </button>
                {assigneeOpen && (
                  <div className="lin-menu tm-menu">
                    <button className="lin-menu-item" onClick={() => { setAssigneeId(null); setAssigneeOpen(false); }}>
                      {t('tasks.unassigned')}
                    </button>
                    {members.map((m) => (
                      <button key={m.userId} className="lin-menu-item" onClick={() => { setAssigneeId(m.userId); setAssigneeOpen(false); }}>
                        <span className="prow-updated-icon" style={avatarStyle(m.name)} aria-hidden="true">{initial(m.name)}</span>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <LabelPicker value={tags} labels={labels} onChange={setTags} onCreate={createLabel} />
          </div>

          {/* pipelines */}
          <div className="tm-pipes">
            <div className="tm-pipes-head">
              <PipelinesIcon width={14} height={14} style={{ color: 'var(--accent-pipelines)' }} />
              <span className="tm-pipes-title">{t('tasks.pipelinesLabel')}</span>
              <span className="tm-pipes-sub">{t('tasks.pipelinesRunOn')}</span>
            </div>
            <div className="tm-pipes-list">
              {assigned.map((p) => (
                <div className="tm-pipe" key={p.id}>
                  <span className="tm-pipe-ico"><PipelinesIcon width={14} height={14} /></span>
                  <div className="tm-pipe-id">
                    <div className="tm-pipe-name">{p.name}</div>
                    <div className="tm-pipe-meta">{t('projects.stepCount', { count: p.steps.length })}</div>
                  </div>
                  <button type="button" className="tm-pipe-del" aria-label={t('common.remove')} onClick={() => setPipelines((ids) => ids.filter((x) => x !== p.id))}>
                    <XIcon width={12} height={12} />
                  </button>
                </div>
              ))}
              {assigned.length === 0 && <div className="tm-pipes-empty">{t('tasks.noPipelinesYet')}</div>}
              <div className="tm-assign-wrap" ref={pipeRef}>
                <button type="button" className="tm-assign" onClick={() => setPipeOpen((o) => !o)} disabled={available.length === 0}>
                  <PlusIcon width={13} height={13} /> {t('tasks.assignPipeline')}
                </button>
                {pipeOpen && available.length > 0 && (
                  <div className="lin-menu tm-assign-menu">
                    {available.map((p) => (
                      <button key={p.id} className="lin-menu-item" onClick={() => { setPipelines((ids) => [...ids, p.id]); setPipeOpen(false); }}>
                        <span className="tm-pipe-ico" style={{ width: 24, height: 24 }}><PipelinesIcon width={13} height={13} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="tm-pipe-name">{p.name}</span>
                          <span className="tm-pipe-meta" style={{ display: 'block' }}>{t('projects.stepCount', { count: p.steps.length })}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="tm-foot">
          <span className="tm-foot-note">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><circle cx="8" cy="8" r="6.4" /><path d="M8 5.2v3.4l2.2 1.3" /></svg>
            {t('tasks.inheritsVariables')}
          </span>
          <div className="tm-foot-actions">
            <button type="button" className="btn-ghost btn-inline btn-sm" onClick={onClose}>{t('tasks.cancel')}</button>
            <button type="button" className="btn-primary btn-inline btn-sm" disabled={busy || !name.trim()} onClick={() => void create()}>
              {t('tasks.createTask')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
