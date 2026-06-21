import { useTranslation } from 'react-i18next';

/**
 * Prev · numbered · Next pager, shared by the library galleries (Marketplace,
 * Prompts, Pipelines, Projects) which each copy-pasted the identical `mkt-pager`
 * markup. Renders nothing for a single page.
 */
export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="mkt-pager">
      <button type="button" className="mkt-page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹ {t('common.prev')}
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`mkt-page-num${n === page ? ' active' : ''}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      <button type="button" className="mkt-page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('common.next')} ›
      </button>
    </div>
  );
}
