import type { Competitor } from '@lyra/shared';

export interface ApprovalsPanelProps {
  candidates: Competitor[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  onApprove: (competitorId: string) => void;
  onReject: (competitorId: string) => void;
}

export function ApprovalsPanel({
  candidates,
  t,
  onApprove,
  onReject,
}: ApprovalsPanelProps) {
  if (!candidates.length) {
    return <div className="mon-empty">{t('monitor.empty')}</div>;
  }

  return (
    <div className="mon-approvals">
      {candidates.map((comp) => (
        <div key={comp.id} className="mon-approval-card">
          <div className="mon-card-content">
            <h4 className="mon-brand">{comp.brand}</h4>
            {comp.domain && <p className="mon-domain">{comp.domain}</p>}
            {comp.niche && <p className="mon-niche">{comp.niche}</p>}
          </div>

          <div className="mon-card-actions">
            <button
              className="mon-btn mon-btn-primary"
              onClick={() => onApprove(comp.id)}
              type="button"
            >
              {t('monitor.approve')}
            </button>
            <button
              className="mon-btn mon-btn-secondary"
              onClick={() => onReject(comp.id)}
              type="button"
            >
              {t('monitor.reject')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
