import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColor, type LabelInfo, type Prompt } from '@lyra/shared';
import { EyeIcon, FilterIcon } from '../layout/icons';
import { PromptDetails } from './PromptDetails';

function initial(name?: string) {
  const n = (name ?? '').trim();
  return n ? n[0].toUpperCase() : '?';
}

// Add-step prompt picker (Linear-style). Search by name + a Filter button that
// reveals tag chips. Each card: name + eye (view full), a 2-line snippet, then
// created-by · model, then tags. Tap a card to select; the caller's ✓ confirms.
export function PromptPicker({
  prompts,
  labels,
  value,
  onChange,
  modelLabel,
}: {
  prompts: Prompt[];
  labels: LabelInfo[];
  value: string;
  onChange: (id: string) => void;
  /** Resolve a prompt's model to a readable label (provider catalog). */
  modelLabel?: (p: Prompt) => string;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [detail, setDetail] = useState<Prompt | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    prompts.forEach((p) => p.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [prompts]);

  const ql = q.trim().toLowerCase();
  const list = prompts.filter(
    (p) =>
      (!ql || p.title.toLowerCase().includes(ql)) &&
      (activeTags.length === 0 || activeTags.some((t) => p.tags.includes(t))),
  );

  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="ppick">
      <div className="ppick-searchrow">
        <input
          className="text-input ppick-search"
          placeholder={t('prompts.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className={`ppick-filterbtn ${showFilter || activeTags.length ? 'on' : ''}`}
          onClick={() => setShowFilter((s) => !s)}
          title={t('prompts.filterByTags')}
          aria-label={t('prompts.filterByTags')}
        >
          <FilterIcon width={15} height={15} />
        </button>
      </div>

      {showFilter &&
        (allTags.length > 0 ? (
          <div className="ppick-tags">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`ppick-tagchip ${activeTags.includes(t) ? 'on' : ''}`}
                onClick={() => toggleTag(t)}
              >
                <span className="tdot" style={{ background: labelColor(t, labels) }} />
                {t}
              </button>
            ))}
          </div>
        ) : (
          <p className="ppick-empty" style={{ padding: '2px 2px' }}>{t('prompts.noTagsYet')}</p>
        ))}

      <div className="ppick-grid">
        {prompts.length === 0 ? (
          <p className="ppick-empty">{t('prompts.noPublicPrompts')}</p>
        ) : list.length === 0 ? (
          <p className="ppick-empty">{t('prompts.noMatchFilters')}</p>
        ) : (
          list.map((p) => {
            const ml = modelLabel?.(p) ?? p.model ?? '';
            return (
              <button
                key={p.id}
                type="button"
                className={`ppick-card ${value === p.id ? 'active' : ''}`}
                onClick={() => onChange(p.id)}
              >
                <div className="ppick-card-top">
                  <span className="ppick-name">{p.title}</span>
                  <span
                    className="ppick-eye"
                    role="button"
                    tabIndex={0}
                    title={t('prompts.viewFullPrompt')}
                    onClick={(e) => { e.stopPropagation(); setDetail(p); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDetail(p); } }}
                  >
                    <EyeIcon width={15} height={15} />
                  </span>
                </div>
                {p.content.trim() && <div className="ppick-snip">{p.content}</div>}
                <div className="ppick-byrow">
                  <span className="ppick-by">
                    <span className="ppick-avatar">{initial(p.createdBy.name)}</span>
                    {p.createdBy.name}
                  </span>
                  {ml && <span className="ppick-model">{ml}</span>}
                </div>
                {p.tags.length > 0 && (
                  <div className="ppick-cardtags">
                    {p.tags.slice(0, 5).map((t) => (
                      <span key={t} className="tag-chip ro">
                        <span className="tdot" style={{ background: labelColor(t, labels) }} />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {detail && <PromptDetails prompt={detail} labels={labels} onClose={() => setDetail(null)} />}
    </div>
  );
}
