import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Mobile "one step per page" pager (doc decision 15). Pages are:
//   0 = Start · 1..N = steps · N+1 = End
// Desktop renders the full vertical flow; mobile folds it into this pager.
export function useFlowPager(stepCount: number) {
  const total = stepCount + 2; // Start + steps + End
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches,
  );
  const [page, setPage] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // keep the page in range when steps are added/removed
  useEffect(() => {
    setPage((p) => Math.min(p, total - 1));
  }, [total]);

  return {
    isMobile,
    page,
    total,
    setPage,
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(total - 1, p + 1)),
    atStart: page === 0,
    atEnd: page === total - 1,
  };
}

export type FlowPager = ReturnType<typeof useFlowPager>;

export function FlowPagerControls({ pager, stepCount }: { pager: FlowPager; stepCount: number }) {
  const { t } = useTranslation();
  const { page, total, prev, next, atStart, atEnd } = pager;
  const label = page === 0
    ? t('common.start')
    : page === total - 1
      ? t('common.end')
      : t('run.stepOf', { page, total: stepCount });
  return (
    <div className="flow-pager-bar">
      <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={atStart} onClick={prev}>
        ‹ {t('common.previous')}
      </button>
      <span className="flow-pager-label">{label}</span>
      <button className="btn-ghost" style={{ width: 'auto', marginTop: 0 }} disabled={atEnd} onClick={next}>
        {t('common.next')} ›
      </button>
    </div>
  );
}
