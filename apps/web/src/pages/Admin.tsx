import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
} from '@lyra/shared';
import { useAuth } from '../auth/useAuth';
import { initial, avatarStyle } from '../lib/format';
import { adminApi, type CatalogStats } from '../lib/admin';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MembersIcon, RefreshIcon, XIcon } from '../layout/icons';
import './admin.css';

type Tab = 'overview' | 'users' | 'platform';
const TABS: Tab[] = ['overview', 'users', 'platform'];
const PAGE_SIZE = 15;

// Format an ISO timestamp for the "Last synced" fact. Locale-aware (matches the
// rest of the app), null-safe (renders the "Never" copy upstream).
function formatSynced(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// Short date for list rows (joined-on column).
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

// Super-admin surface: platform operations that span the whole install (not a
// single workspace). The api guard is the real gate — this page only reveals it
// to admins and otherwise redirects, so a non-admin who guesses the URL bounces.
export function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="admin">
      <h1 className="sr-only">{t('admin.heading')}</h1>

      <div className="seg admin-tabs" role="tablist" aria-label={t('admin.heading')}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`seg-btn ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(`admin.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewSection />}
      {tab === 'users' && <UsersSection />}
      {tab === 'platform' && <PlatformSection />}
    </div>
  );
}

// ===== Overview =====

const STAT_KEYS = [
  'users',
  'workspaces',
  'projects',
  'pipelines',
  'prompts',
  'runs',
  'chats',
] as const;

function OverviewSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi
      .overview()
      .then((o) => !cancelled && setData(o))
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('admin.error'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) return <p className="empty">{t('admin.loading')}</p>;
  if (error || !data)
    return (
      <p className="error" role="alert">
        {error ?? t('admin.error')}
      </p>
    );

  return (
    <section className="set-section" aria-labelledby="admin-overview-title">
      <div className="set-section-head">
        <h2 id="admin-overview-title">{t('admin.tab.overview')}</h2>
        <p>{t('admin.overviewDesc')}</p>
      </div>

      <div className="admin-stat-grid">
        {STAT_KEYS.map((key) => (
          <div className="admin-stat" key={key}>
            <span className="admin-stat-num">{data[key].toLocaleString()}</span>
            <span className="admin-stat-label">{t(`admin.stat.${key}`)}</span>
          </div>
        ))}
        <div className="admin-stat admin-stat-accent">
          <span className="admin-stat-num">{data.signups30d.toLocaleString()}</span>
          <span className="admin-stat-label">{t('admin.stat.signups30d')}</span>
        </div>
      </div>

      <div className="admin-recent">
        <h3 className="admin-subhead">{t('admin.recentSignups')}</h3>
        {data.recentSignups.length === 0 ? (
          <p className="empty">{t('admin.noSignups')}</p>
        ) : (
          <ul className="admin-recent-list">
            {data.recentSignups.map((u) => (
              <li className="admin-recent-row" key={u.id}>
                <span className="admin-recent-name">{u.name}</span>
                <span className="admin-recent-email">{u.email}</span>
                <span className="admin-recent-date">{fmtDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ===== Users =====

function UsersSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUserSummary | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => setPage(1), [q]);

  // Debounced load. The search term and page drive a single fetch; a 220ms
  // settle matches the Prompts list so typing doesn't fire a request per keystroke.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      adminApi
        .users({ page, limit: PAGE_SIZE, q })
        .then((res) => {
          if (cancelled) return;
          setRows(res.items);
          setTotal(res.total);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setRows([]);
          setError(err instanceof Error ? err.message : t('admin.error'));
        })
        .finally(() => !cancelled && setLoading(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, q, t]);

  // Reflect a user's new active state in the list (and the open detail) after a
  // deactivate/reactivate.
  const onActiveChanged = useCallback((updated: AdminUserSummary) => {
    setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    setSelected((s) => (s && s.id === updated.id ? { ...s, ...updated } : s));
  }, []);

  // Clicking a card drills into the full user view; back returns to the list.
  if (selected) {
    return (
      <UserDetailView
        row={selected}
        isSelf={selected.id === user?.id}
        onBack={() => setSelected(null)}
        onActiveChanged={onActiveChanged}
      />
    );
  }

  return (
    <section aria-labelledby="admin-users-title">
      <h2 id="admin-users-title" className="sr-only">{t('admin.tab.users')}</h2>

      <div className="lin-toolbar admin-users-toolbar">
        <input
          className="lin-search"
          placeholder={t('admin.searchUsers')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('admin.searchUsers')}
        />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty">{t('admin.loading')}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MembersIcon width={26} height={26} />}
          title={t('admin.noUsersTitle')}
          body={q.trim() ? t('admin.noMatch') : t('admin.noUsersBody')}
        />
      ) : (
        <>
          <div className="lib-grid">
            {rows.map((u) => (
              <UserCard key={u.id} row={u} onOpen={() => setSelected(u)} />
            ))}
          </div>

          <div className="pager">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← {t('admin.prev')}
            </button>
            <span className="pager-info">
              {t('admin.pagerInfo', { page, totalPages, total })}
            </span>
            <button
              className="btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('admin.next')} →
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// Clean user card (no label:value rows) — avatar · name · email, with a status
// badge and a meta line. The whole card opens the detail view.
function UserCard({ row, onOpen }: { row: AdminUserSummary; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="lib-card admin-user-card"
      onClick={onOpen}
      title={t('admin.openUser', { name: row.name })}
    >
      <div className="lib-card-head">
        <span className="admin-uid">
          <span className="admin-uavatar" style={avatarStyle(row.name)} aria-hidden="true">
            {initial(row.name)}
          </span>
          <span className="admin-uid-text">
            <span className="admin-uname">{row.name}</span>
            <span className="admin-uemail">{row.email}</span>
          </span>
        </span>
        <span className={`badge ${row.active ? 'admin-active' : 'admin-inactive'}`}>
          {row.active ? t('admin.active') : t('admin.inactive')}
        </span>
      </div>
      <div className="admin-user-meta">
        <span>{t('admin.joinedOn', { date: fmtDate(row.createdAt) })}</span>
        <span className="pd-dot" aria-hidden="true">·</span>
        <span>{t('admin.workspaceCount', { count: row.workspaceCount })}</span>
      </div>
    </button>
  );
}

const USAGE_KEYS = ['projects', 'pipelines', 'prompts', 'runs', 'chats'] as const;

interface UserDetailViewProps {
  row: AdminUserSummary;
  isSelf: boolean;
  onBack: () => void;
  onActiveChanged: (updated: AdminUserSummary) => void;
}

// Full user detail "page": identity header + workspaces + usage + the
// deactivate/reactivate action. Reached by clicking a user card; Back returns.
function UserDetailView({ row, isSelf, onBack, onActiveChanged }: UserDetailViewProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // The summary row carries name/email/status so the header shows instantly;
  // the detail load fills in workspaces + usage.
  const active = detail?.active ?? row.active;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .user(row.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('admin.error'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [row.id, t]);

  async function applyActive(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.setUserActive(row.id, next);
      setDetail((d) => (d ? { ...d, ...updated } : d));
      onActiveChanged(updated);
      setConfirm(false);
    } catch (err) {
      // The api returns a 400 when you try to deactivate your own account —
      // surface its message rather than a generic error.
      setError(err instanceof Error ? err.message : t('admin.error'));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-udetail-page" aria-label={row.name}>
      <button type="button" className="btn-ghost admin-back" onClick={onBack}>
        ← {t('admin.backToUsers')}
      </button>

      <header className="admin-uid-head">
        <span className="admin-uavatar lg" style={avatarStyle(row.name)} aria-hidden="true">
          {initial(row.name)}
        </span>
        <div className="admin-uid-text">
          <h2 className="admin-uname lg">{row.name}</h2>
          <span className="admin-uemail">{row.email}</span>
        </div>
        <span className={`badge ${active ? 'admin-active' : 'admin-inactive'}`}>
          {active ? t('admin.active') : t('admin.inactive')}
        </span>
      </header>

      {loading && <p className="empty">{t('admin.loading')}</p>}
      {error && !detail && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {detail && (
        <>
          <div className="admin-udetail-cols">
        <div className="admin-udetail-block">
          <h4 className="admin-subhead">{t('admin.workspaces')}</h4>
          {detail.workspaces.length === 0 ? (
            <p className="empty">{t('admin.noWorkspaces')}</p>
          ) : (
            <ul className="admin-ws-list">
              {detail.workspaces.map((ws) => (
                <li className="admin-ws-row" key={ws.id}>
                  <span className="admin-ws-name">{ws.name}</span>
                  <span className="badge admin-role">{t(`admin.role.${ws.role}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-udetail-block">
          <h4 className="admin-subhead">{t('admin.usage')}</h4>
          <div className="admin-usage-grid">
            {USAGE_KEYS.map((key) => (
              <div className="admin-usage" key={key}>
                <span className="admin-usage-num">{detail.usage[key].toLocaleString()}</span>
                <span className="admin-usage-label">{t(`admin.stat.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

          <div className="admin-udetail-actions">
            {active ? (
              <button
                type="button"
                className="btn-danger admin-btn-inline"
                disabled={isSelf || busy}
                title={isSelf ? t('admin.cantDeactivateSelf') : undefined}
                onClick={() => setConfirm(true)}
              >
                <XIcon width={14} height={14} aria-hidden="true" />
                {t('admin.deactivate')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary admin-btn-inline"
                disabled={busy}
                onClick={() => void applyActive(true)}
              >
                <RefreshIcon width={14} height={14} aria-hidden="true" />
                {t('admin.reactivate')}
              </button>
            )}
            {isSelf && active && (
              <span className="admin-self-note">{t('admin.cantDeactivateSelf')}</span>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('admin.deactivateTitle')}
        message={
          <>
            {t('admin.deactivateConfirm')} <strong>{row.name}</strong>?
          </>
        }
        confirmLabel={t('admin.deactivate')}
        danger
        busy={busy}
        onConfirm={() => void applyActive(false)}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}

// ===== Platform =====

function PlatformSection() {
  return <CatalogCard />;
}

// One platform-ops card: the shared prompt catalog. Self-contained (own load +
// sync state) so more cards can sit alongside it later without entangling state.
function CatalogCard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    setError(null);
    try {
      setStats(await adminApi.catalogStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error'));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi
      .catalogStats()
      .then((s) => !cancelled && setStats(s))
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('admin.error'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setDone(null);
    try {
      const { imported } = await adminApi.syncCatalog();
      setDone(imported);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error'));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="set-section" aria-labelledby="admin-catalog-title">
      <div className="set-section-head">
        <h2 id="admin-catalog-title">{t('admin.catalogTitle')}</h2>
        <p>{t('admin.catalogDesc')}</p>
      </div>

      {loading ? (
        <p className="empty">{t('admin.loading')}</p>
      ) : (
        <dl className="admin-facts">
          <div className="admin-fact">
            <dt>{t('admin.catalogCount')}</dt>
            <dd>{(stats?.count ?? 0).toLocaleString()}</dd>
          </div>
          <div className="admin-fact">
            <dt>{t('admin.lastSynced')}</dt>
            <dd>
              {stats?.lastSyncedAt
                ? formatSynced(stats.lastSyncedAt)
                : t('admin.neverSynced')}
            </dd>
          </div>
        </dl>
      )}

      <div className="admin-actions">
        <button
          type="button"
          className="btn-primary admin-btn-inline"
          onClick={() => void sync()}
          disabled={syncing || loading}
        >
          <RefreshIcon
            width={15}
            height={15}
            className={syncing ? 'icon spin' : 'icon'}
            aria-hidden="true"
          />
          {syncing ? t('admin.syncing') : t('admin.sync')}
        </button>
        {done != null && !error && (
          <p className="admin-ok" role="status" aria-live="polite">
            {t('admin.imported', { count: done })}
          </p>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
