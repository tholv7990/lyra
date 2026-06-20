import { useState, type ReactNode } from 'react';
import { TaskStatus, TaskPriority, Provider, type LabelInfo } from '@lyra/shared';
import { avatarStyle, initial } from '../lib/format';
import { Checkbox } from '../components/Checkbox';
import { Toggle } from '../components/Toggle';
import { Tooltip } from '../components/Tooltip';
import { Toast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { TaskStatusIcon } from '../components/TaskStatusIcon';
import { TaskStatusPicker } from '../components/TaskStatusPicker';
import { TaskPriorityIcon } from '../components/TaskPriorityIcon';
import { TaskPriorityPicker } from '../components/TaskPriorityPicker';
import { ProviderIcon } from '../components/ProviderIcon';
import { LabelPicker } from '../components/LabelPicker';
import { CheckIcon, XIcon, PencilIcon, PlusIcon } from '../layout/icons';

// Dev reference: every shared component at real tokens. ponytail: strings are
// hardcoded English on purpose — this is internal tooling, not product copy.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cg-section">
      <h2>{title}</h2>
      <div className="cg-grid">{children}</div>
    </section>
  );
}
function Cell({ cap, col, children }: { cap: string; col?: boolean; children: ReactNode }) {
  return (
    <div className="cg-cell">
      <div className={`cg-demo${col ? ' col' : ''}`}>{children}</div>
      <span className="cg-cap">{cap}</span>
    </div>
  );
}

const TOKENS = [
  '--primary', '--success', '--warning', '--danger', '--info',
  '--surface-1', '--surface-2', '--surface-3', '--card',
  '--ink', '--ink-muted', '--ink-tertiary', '--hairline',
];

export function Components() {
  const [chk, setChk] = useState(true);
  const [tgl, setTgl] = useState(true);
  const [status, setStatus] = useState(TaskStatus.InProgress);
  const [priority, setPriority] = useState(TaskPriority.High);
  const [tags, setTags] = useState<string[]>(['design']);
  const [toast, setToast] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const labels: LabelInfo[] = [
    { id: '1', name: 'design', color: '#8b5cf6' },
    { id: '2', name: 'bug', color: '#e5484d' },
    { id: '3', name: 'copy', color: '#2da44e' },
  ];
  const stubCreate = async (name: string, color: string): Promise<LabelInfo> => ({ id: name, name, color });

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2600);
  };

  return (
    <div className="cgallery">
      <div className="cgallery-head">
        <h1>Component library</h1>
        <p>Every shared building block at real tokens — the reference for composing pages consistently.</p>
      </div>

      <Section title="Foundations — tokens">
        <div className="cg-demo">
          {TOKENS.map((name) => (
            <div className="cg-swatch" key={name}>
              <span style={{ background: `var(${name})` }} />
              <small>{name}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <Cell cap="Primary"><button className="btn-primary btn-inline">Save changes</button></Cell>
        <Cell cap="Secondary"><button className="btn-ghost btn-inline">Cancel</button></Cell>
        <Cell cap="Danger"><button className="btn-danger btn-inline">Delete</button></Cell>
        <Cell cap="Disabled"><button className="btn-primary btn-inline" disabled>Save changes</button></Cell>
        <Cell cap="Sizes">
          <button className="btn-primary btn-inline btn-lg">Large</button>
          <button className="btn-primary btn-inline">Default</button>
          <button className="btn-primary btn-inline btn-sm">Small</button>
          <button className="btn-primary btn-inline btn-xs">XS</button>
        </Cell>
        <Cell cap="Icon buttons">
          <IconButton label="Confirm" variant="success" icon={<CheckIcon width={16} height={16} />} />
          <IconButton label="Cancel" variant="danger" icon={<XIcon />} />
          <IconButton label="Edit" icon={<PencilIcon width={16} height={16} />} />
        </Cell>
        <Cell cap="Text link"><button className="txt-btn">Edit variables</button></Cell>
      </Section>

      <Section title="Inputs">
        <Cell cap="Text input"><input className="text-input" defaultValue="Aurora Skincare" style={{ width: 200 }} /></Cell>
        <Cell cap="Placeholder"><input className="text-input" placeholder="Search projects…" style={{ width: 200 }} /></Cell>
        <Cell cap="Textarea"><textarea className="text-input" rows={2} defaultValue="A short description." style={{ width: 220 }} /></Cell>
      </Section>

      <Section title="Selection controls">
        <Cell cap="Checkbox">
          <Checkbox checked={chk} onChange={setChk} label="Email verified" />
          <Checkbox checked={false} onChange={() => {}} label="Off" />
          <Checkbox checked disabled label="Disabled" />
        </Cell>
        <Cell cap="Toggle">
          <Toggle checked={tgl} onChange={setTgl} label="Auto-save" />
          <Toggle checked={false} onChange={() => {}} label="Off" />
        </Cell>
        <Cell cap="Segmented">
          <div className="seg" role="radiogroup">
            <button type="button" role="radio" aria-checked="true" className="seg-btn active">Draft</button>
            <button type="button" role="radio" aria-checked="false" className="seg-btn">Public</button>
          </div>
        </Cell>
      </Section>

      <Section title="Status &amp; meta">
        <Cell cap="Badges">
          <span className="badge status-draft">Draft</span>
          <span className="badge status-public">Public</span>
          <span className="badge status-done">Done</span>
          <span className="badge status-error">Error</span>
        </Cell>
        <Cell cap="Label chips">
          {labels.map((l) => (
            <span className="tag-chip" key={l.id}>
              <span className="tdot" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </Cell>
        <Cell cap="Avatars">
          {['Lê Thọ', 'Maria K', 'Design QA'].map((n) => (
            <span className="prow-updated-icon" style={avatarStyle(n)} key={n}>{initial(n)}</span>
          ))}
        </Cell>
        <Cell cap="Status icons">
          {[TaskStatus.New, TaskStatus.InProgress, TaskStatus.OnHold, TaskStatus.Complete].map((s) => (
            <TaskStatusIcon status={s} key={s} />
          ))}
        </Cell>
        <Cell cap="Priority icons">
          {[TaskPriority.None, TaskPriority.Urgent, TaskPriority.High, TaskPriority.Medium, TaskPriority.Low].map((p) => (
            <TaskPriorityIcon priority={p} key={p} />
          ))}
        </Cell>
        <Cell cap="Provider icons">
          {[Provider.Anthropic, Provider.OpenAI, Provider.DeepSeek].map((p) => (
            <ProviderIcon provider={p} size={20} key={p} />
          ))}
        </Cell>
        <Cell cap="Skeleton" col>
          <span className="skel-line" style={{ width: 180 }} />
          <span className="skel-line" style={{ width: 120 }} />
        </Cell>
      </Section>

      <Section title="Pickers (trigger → menu)">
        <Cell cap="Status"><TaskStatusPicker status={status} onChange={setStatus} /></Cell>
        <Cell cap="Priority"><TaskPriorityPicker priority={priority} onChange={setPriority} /></Cell>
        <Cell cap="Labels"><LabelPicker value={tags} labels={labels} onChange={setTags} onCreate={stubCreate} /></Cell>
      </Section>

      <Section title="Overlays &amp; feedback">
        <Cell cap="Menu" col>
          <div className="lin-menu" style={{ position: 'static', width: 200, maxHeight: 'none' }}>
            <button type="button" className="lin-menu-item"><span className="dot" style={{ background: 'var(--ink-tertiary)' }} />First option</button>
            <button type="button" className="lin-menu-item"><span className="dot" style={{ background: 'var(--success)' }} />Second option</button>
            <button type="button" className="lin-menu-item"><span className="dot" style={{ background: 'var(--warning)' }} />Third option</button>
          </div>
        </Cell>
        <Cell cap="Tooltip"><Tooltip label="Move project to a team"><button className="btn-ghost btn-inline">Hover me</button></Tooltip></Cell>
        <Cell cap="Toast" col>
          <Toast message="Changes saved." kind="success" />
          <Toast message="Connection failed. Please try again." kind="error" />
          <button className="btn-ghost btn-inline" onClick={showToast}>Show toast</button>
        </Cell>
        <Cell cap="Dialog"><button className="btn-danger btn-inline" onClick={() => setConfirm(true)}>Delete project…</button></Cell>
        <Cell cap="Command bar (⌘K)"><button className="btn-ghost btn-inline" onClick={() => document.dispatchEvent(new CustomEvent('lyra:command-bar'))}>Open ⌘K</button></Cell>
      </Section>

      <Section title="Layout">
        <Cell cap="Card">
          <div className="lib-card cg-card-sample">
            <div className="lib-card-head">
              <div className="lib-card-title">Aurora Skincare</div>
            </div>
            <div className="lib-card-body muted">Crawl + Lyra-brand the store</div>
          </div>
        </Cell>
        <Cell cap="Row" col>
          <div className="list" style={{ width: 320 }}>
            <div className="row">
              <div className="grow"><div className="title">Launch landing copy</div><div className="sub">Jun 20 2026</div></div>
              <span className="badge status-done">Done</span>
            </div>
          </div>
        </Cell>
        <Cell cap="Task row" col>
          <ul className="tgroup-rows" style={{ width: 320 }}>
            <li>
              <span className="trow" style={{ cursor: 'default' }}>
                <TaskStatusIcon status={TaskStatus.InProgress} size={16} />
                <span className="trow-name">Launch landing copy</span>
                <span className="trow-meta">
                  <span className="tag-chip trow-tag"><span className="tdot" style={{ background: '#8b5cf6' }} />design</span>
                  <TaskPriorityIcon priority={TaskPriority.High} size={15} />
                  <span className="trow-chev" aria-hidden="true">›</span>
                </span>
              </span>
            </li>
          </ul>
        </Cell>
        <Cell cap="Empty state">
          <div style={{ width: 320 }}>
            <EmptyState
              icon={<PlusIcon width={26} height={26} />}
              title="No tasks yet"
              body="Tasks group the pipelines you run for this project."
              cta={{ label: 'Add task', onClick: () => {} }}
            />
          </div>
        </Cell>
      </Section>

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 80 }}>
          <Toast message="Saved — toast demo." kind="info" onClose={() => setToast(false)} />
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title="Delete project?"
        message="This project and its runs will be removed. This can’t be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
