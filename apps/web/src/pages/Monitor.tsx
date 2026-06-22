import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompetitorStatus, MediaType, type Competitor, type MonitorStats, type MonitorAd } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { useAuth } from '../auth/useAuth';
import { monitorApi } from '../lib/monitor';
import { useMediaViewer } from '../components/MediaViewer';
import { EmptyState } from '../components/EmptyState';
import { ChangelogFeed } from '../components/monitor/ChangelogFeed';
import { WatchlistPanel } from '../components/monitor/WatchlistPanel';
import { ApprovalsPanel } from '../components/monitor/ApprovalsPanel';
import { PlusIcon } from '../layout/icons';
import './monitor.css';

type TabType = 'changelog' | 'watchlist' | 'approvals';

export function Monitor() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const { user } = useAuth();

  // State
  const [tab, setTab] = useState<TabType>('changelog');
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [byDay, setByDay] = useState<{ date: string; competitors: any[] }[]>([]);
  const [watching, setWatching] = useState<Competitor[]>([]);
  const [candidates, setCandidates] = useState<Competitor[]>([]);
  const [ads, setAds] = useState<MonitorAd[]>([]);
  const [discoverKeyword, setDiscoverKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [noKeyError, setNoKeyError] = useState(false);

  const wsId = current?.id;
  const { open, viewer } = useMediaViewer();

  const handleOpenMedia = (media: { url: string; type: string }) => {
    open({ url: media.url, type: media.type as MediaType });
  };

  // Load initial data
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setNoKeyError(false);

      try {
        // Load changelog
        const changelogData = await monitorApi.changelog(wsId, 7);
        if (!cancelled) {
          setStats(changelogData.stats);
          setByDay(changelogData.byDay);
        }

        // Load watching competitors
        const watchingList = await monitorApi.list(wsId, CompetitorStatus.Watching);
        if (!cancelled) {
          setWatching(watchingList);
        }

        // Load candidates
        const candidatesList = await monitorApi.list(wsId, CompetitorStatus.Candidate);
        if (!cancelled) {
          setCandidates(candidatesList);
        }

        // Load active ads
        const adsList = await monitorApi.ads(wsId);
        if (!cancelled) {
          setAds(adsList);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || String(err);
          if (msg.includes('Add an Apify key') || msg.includes('credentials not configured')) {
            setNoKeyError(true);
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  // Handle discover
  const handleDiscover = async () => {
    if (!wsId || !discoverKeyword.trim()) return;
    setIsDiscovering(true);
    try {
      const keywords = discoverKeyword
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const discovered = await monitorApi.discover(wsId, keywords);
      setCandidates([...candidates, ...discovered]);
      setDiscoverKeyword('');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsDiscovering(false);
    }
  };

  // Handle approve/reject/remove
  const handleApprove = async (cid: string) => {
    if (!wsId) return;
    try {
      await monitorApi.approve(wsId, cid);
      setCandidates(candidates.filter((c) => c.id !== cid));
      const updated = await monitorApi.list(wsId, CompetitorStatus.Watching);
      setWatching(updated);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleReject = async (cid: string) => {
    if (!wsId) return;
    try {
      await monitorApi.reject(wsId, cid);
      setCandidates(candidates.filter((c) => c.id !== cid));
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRemove = async (cid: string) => {
    if (!wsId) return;
    try {
      await monitorApi.remove(wsId, cid);
      setWatching(watching.filter((c) => c.id !== cid));
      const updatedAds = ads.filter((a) => a.competitorId !== cid);
      setAds(updatedAds);
    } catch (err) {
      setError(String(err));
    }
  };

  // UI states
  if (!user) return null;

  if (noKeyError) {
    return (
      <div className="page mon-page">
        <div className="page-header">
          <h1>{t('monitor.title')}</h1>
          <p className="subtitle">{t('monitor.subtitle')}</p>
        </div>
        <div className="page-content">
          <EmptyState
            icon="⚙️"
            title={t('monitor.noKey')}
            body="Go to Connections to add your Apify API key"
            cta={{
              label: 'Open Connections',
              onClick: () => window.location.href = '/connections',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page mon-page">
      <div className="page-header">
        <h1>{t('monitor.title')}</h1>
        <p className="subtitle">{t('monitor.subtitle')}</p>
      </div>

      <div className="page-content">
        {/* Stats strip */}
        {stats && (
          <div className="mon-stats">
            <div className="mon-stat-item">
              <span className="mon-stat-label">{t('monitor.statNew')}</span>
              <span className="mon-stat-value">{stats.newToday}</span>
            </div>
            <div className="mon-stat-item">
              <span className="mon-stat-label">{t('monitor.statStopped')}</span>
              <span className="mon-stat-value">{stats.stoppedToday}</span>
            </div>
            <div className="mon-stat-item">
              <span className="mon-stat-label">{t('monitor.statWatching')}</span>
              <span className="mon-stat-value">{stats.watching}</span>
            </div>
          </div>
        )}

        {/* Discover section */}
        <div className="mon-discover">
          <div className="mon-discover-input">
            <input
              type="text"
              placeholder={t('monitor.discoverPlaceholder')}
              value={discoverKeyword}
              onChange={(e) => setDiscoverKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
              className="mon-input"
              disabled={isDiscovering}
            />
            <button
              className="mon-btn mon-btn-primary mon-discover-btn"
              onClick={handleDiscover}
              disabled={isDiscovering || !discoverKeyword.trim()}
              type="button"
            >
              <PlusIcon />
              {t('monitor.discoverCta')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mon-tabs">
          <button
            className={`mon-tab ${tab === 'changelog' ? 'active' : ''}`}
            onClick={() => setTab('changelog')}
            type="button"
          >
            {t('monitor.tabChangelog')}
          </button>
          <button
            className={`mon-tab ${tab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setTab('watchlist')}
            type="button"
          >
            {t('monitor.tabWatchlist')} ({watching.length})
          </button>
          <button
            className={`mon-tab ${tab === 'approvals' ? 'active' : ''}`}
            onClick={() => setTab('approvals')}
            type="button"
          >
            {t('monitor.tabApprovals')} ({candidates.length})
          </button>
        </div>

        {/* Loading state */}
        {loading && <div className="mon-loading">{t('monitor.loading')}</div>}

        {/* Error state */}
        {error && !loading && (
          <div className="mon-error">
            <span>{t('monitor.error')}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="mon-error-close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab content */}
        {!loading && (
          <>
            {tab === 'changelog' && (
              <ChangelogFeed
                t={t}
                byDay={byDay}
                onOpen={handleOpenMedia}
              />
            )}
            {tab === 'watchlist' && (
              <WatchlistPanel
                competitors={watching}
                ads={ads}
                t={t}
                onRemove={handleRemove}
                onOpen={handleOpenMedia}
              />
            )}
            {tab === 'approvals' && (
              <ApprovalsPanel
                candidates={candidates}
                t={t}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
          </>
        )}
      </div>

      {viewer}
    </div>
  );
}
