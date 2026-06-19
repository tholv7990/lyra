import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  LABEL_COLORS,
  labelColor,
  normalizeTag,
  tagKey,
  type LabelInfo,
} from '@lyra/shared';
import { useOutsideClick } from '../lib/useOutsideClick';
import { CheckIcon, PlusIcon } from '../layout/icons';

interface LabelPickerProps {
  value: string[]; // selected label names
  labels: LabelInfo[]; // workspace label vocabulary
  onChange: (names: string[]) => void;
  onCreate: (name: string, color: string) => Promise<LabelInfo | null>;
}

// Linear's "Add label" flow: a trigger button → searchable dropdown of the
// workspace labels (toggle to add/remove) → "Create new label" when nothing
// matches → pick a colour → the new label is created, saved, and selected.
export function LabelPicker({ value, labels, onChange, onCreate }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [creating, setCreating] = useState<string | null>(null); // name awaiting a colour
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(value.map(tagKey)), [value]);
  const q = normalizeTag(text);
  const qKey = tagKey(text);

  const matches = useMemo(
    () => labels.filter((l) => (qKey ? tagKey(l.name).includes(qKey) : true)),
    [labels, qKey],
  );
  const exact = labels.some((l) => tagKey(l.name) === qKey);
  const canCreate = q.length > 0 && !exact;

  function close() {
    setOpen(false);
    setCreating(null);
    setText('');
  }
  function openMenu() {
    setOpen(true);
    setCreating(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  useOutsideClick(wrapRef, open, close);

  function toggle(name: string) {
    if (selected.has(tagKey(name))) {
      onChange(value.filter((t) => tagKey(t) !== tagKey(name)));
    } else {
      onChange([...value, name]);
    }
  }
  function remove(name: string) {
    onChange(value.filter((t) => tagKey(t) !== tagKey(name)));
  }

  async function pickColor(color: string) {
    if (!creating || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(creating, color);
      const name = created ? created.name : creating;
      if (!selected.has(tagKey(name))) onChange([...value, name]);
      close();
    } catch {
      // creation failed — keep the picker open so the user can retry
    } finally {
      setBusy(false);
    }
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const m = labels.find((l) => tagKey(l.name) === qKey);
      if (m) toggle(m.name);
      else if (canCreate) setCreating(q);
    } else if (e.key === 'Escape') {
      close();
    }
  }

  return (
    <div className="labelpick" ref={wrapRef}>
      <div className="labelpick-chips">
        {value.map((name) => (
          <span key={name} className="tag-chip">
            <span className="tdot" style={{ background: labelColor(name, labels) }} />
            {name}
            <button
              type="button"
              className="tag-x"
              aria-label={`Remove ${name}`}
              onClick={() => remove(name)}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className={value.length ? 'labelpick-add' : 'labelpick-add empty'}
          aria-label="Add label"
          onClick={() => (open ? close() : openMenu())}
        >
          <PlusIcon />
          {value.length === 0 && <span>Add label</span>}
        </button>
      </div>

      {open && (
        <div className="labelpick-menu">
          {creating === null ? (
            <>
              <div className="labelpick-search">
                <input
                  ref={inputRef}
                  value={text}
                  placeholder="Add labels…"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onSearchKey}
                />
                <kbd>L</kbd>
              </div>
              <div className="labelpick-list">
                {matches.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="labelpick-item"
                    onClick={() => toggle(l.name)}
                  >
                    <span className="tdot" style={{ background: l.color }} />
                    <span className="labelpick-name">{l.name}</span>
                    {selected.has(tagKey(l.name)) && <CheckIcon />}
                  </button>
                ))}
                {canCreate && (
                  <button
                    type="button"
                    className="labelpick-item labelpick-create"
                    onClick={() => setCreating(q)}
                  >
                    <PlusIcon />
                    <span>
                      Create new label: <strong>“{q}”</strong>
                    </span>
                  </button>
                )}
                {matches.length === 0 && !canCreate && (
                  <div className="labelpick-empty">No labels yet</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="labelpick-colorhead">Pick a color for label</div>
              <div className="labelpick-list">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="labelpick-item"
                    disabled={busy}
                    onClick={() => pickColor(c.value)}
                  >
                    <span className="tdot" style={{ background: c.value }} />
                    <span className="labelpick-name">{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
