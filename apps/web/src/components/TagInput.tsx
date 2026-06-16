import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  dedupeTags,
  normalizeTag,
  tagColor,
  tagKey,
  type TagCount,
} from '@lyra/shared';

interface TagInputProps {
  value: string[];
  suggestions: TagCount[];
  onChange: (tags: string[]) => void;
}

function chipStyle(tag: string): CSSProperties {
  const c = tagColor(tag);
  return { color: c, borderColor: `${c}55`, background: `${c}14` };
}

// A tag picker: type to filter the workspace vocabulary, click a suggestion or
// press Enter/comma to add, and reuse existing tags instead of creating
// duplicates (matching is case-insensitive, via the shared tag helpers).
export function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedKeys = useMemo(() => new Set(value.map(tagKey)), [value]);
  const q = normalizeTag(text);
  const qKey = tagKey(text);

  const matches = useMemo(
    () =>
      suggestions
        .filter((s) => !selectedKeys.has(tagKey(s.value)))
        .filter((s) => (qKey ? tagKey(s.value).includes(qKey) : true))
        .slice(0, 8),
    [suggestions, selectedKeys, qKey],
  );

  const canCreate =
    q.length > 0 &&
    !selectedKeys.has(qKey) &&
    !suggestions.some((s) => tagKey(s.value) === qKey);

  function add(tag: string) {
    onChange(dedupeTags([...value, tag]));
    setText('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function remove(tag: string) {
    onChange(value.filter((t) => tagKey(t) !== tagKey(tag)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && q) {
      e.preventDefault();
      const exact = suggestions.find((s) => tagKey(s.value) === qKey);
      add(exact ? exact.value : q);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="tag-input">
      <div className="tag-input-box" onClick={() => inputRef.current?.focus()}>
        {value.map((t) => (
          <span key={t} className="tag-chip" style={chipStyle(t)}>
            <span className="tdot" style={{ background: tagColor(t) }} />
            {t}
            <button
              type="button"
              className="tag-x"
              aria-label={`Remove ${t}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(t);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '' : 'Add tags…'}
        />
      </div>

      {open && (matches.length > 0 || canCreate) && (
        <div className="tag-suggest">
          {matches.map((s) => (
            <button
              key={s.value}
              type="button"
              className="tag-suggest-item"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s.value);
              }}
            >
              <span className="tdot" style={{ background: tagColor(s.value) }} />
              {s.value}
              <span className="count">{s.count}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="tag-suggest-item tag-suggest-create"
              onMouseDown={(e) => {
                e.preventDefault();
                add(q);
              }}
            >
              Create <strong>{q}</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
