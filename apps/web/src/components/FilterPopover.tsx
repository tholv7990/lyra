import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutsideClick } from '../lib/useOutsideClick';
import { useEscapeKey } from '../lib/useEscapeKey';
import { FilterIcon } from '../layout/icons';

interface Props {
  /** Trigger label (e.g. t('prompts.filter')). */
  label: string;
  /** Number of active filters — shown as a count badge, drives the active state. */
  count: number;
  /** Clears all filters; the Clear button is disabled when count is 0. */
  onClear: () => void;
  /** The filter sections — `.lin-menu-label` headers + `.lin-menu-item` rows. */
  children: ReactNode;
}

/**
 * The shared Filter button + `.lin-menu` popover used across the library
 * galleries (Prompts, Pipelines, Projects, Members, Marketplace). Owns the
 * open state, outside-click/Escape close, the trigger, and the Clear action;
 * each page supplies only its filter sections as children. Replaces the shell
 * that was copy-pasted (and drifting) across every page.
 */
export function FilterPopover({ label, count, onClear, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));
  useEscapeKey(() => setOpen(false), open);

  return (
    <div className="mkt-filter" ref={ref}>
      <button
        type="button"
        className={`mkt-tool-btn${count > 0 || open ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((s) => !s)}
      >
        <FilterIcon width={15} height={15} />
        {label}
        {count > 0 && <span className="mkt-filter-count">{count}</span>}
      </button>
      {open && (
        <div className="lin-menu">
          <div className="lin-menu-actions">
            <button
              type="button"
              className="lin-menu-clear"
              disabled={count === 0}
              onClick={onClear}
            >
              {t('common.clear')}
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
