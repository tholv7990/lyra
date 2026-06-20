import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApiKeyInfo, Paged, Pipeline, Project, Prompt } from '@lyra/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import {
  gettingStartedProgress,
  gettingStartedSteps,
  type WorkspaceStats,
} from '../lib/gettingStarted';
import {
  ProjectsIcon,
  PromptsIcon,
  ChatsIcon,
  PipelinesIcon,
  MarketplaceIcon,
  ImportIcon,
  PublishIcon,
  SettingsIcon,
  MembersIcon,
  CheckIcon,
  ChevronIcon,
  PlusIcon,
} from '../layout/icons';
import { IconButton } from '../components/IconButton';

interface Tile {
  to?: string;
  icon: typeof ProjectsIcon;
  accent: string;
  // i18n key prefix under home.* — `${key}Title`, `${key}Body`, `${key}Cta`.
  key: string;
  cta?: boolean;
  soon?: boolean;
}

const TILES: Tile[] = [
  { to: '/chats', icon: ChatsIcon, accent: 'var(--accent-chats)', key: 'chats', cta: true },
  { to: '/marketplace', icon: MarketplaceIcon, accent: 'var(--accent-marketplace)', key: 'marketplace', cta: true },
  { to: '/prompts', icon: PromptsIcon, accent: 'var(--accent-prompts)', key: 'prompts', cta: true },
  { to: '/pipelines', icon: PipelinesIcon, accent: 'var(--accent-pipelines)', key: 'pipelines', cta: true },
  { to: '/projects', icon: ProjectsIcon, accent: 'var(--accent-projects)', key: 'projects', cta: true },
  { to: '/import', icon: ImportIcon, accent: 'var(--accent-import)', key: 'import', cta: true },
  { to: '/publish', icon: PublishIcon, accent: 'var(--accent-publish)', key: 'publish', cta: true },
  { to: '/settings', icon: SettingsIcon, accent: 'var(--accent-keys)', key: 'keys', cta: true },
  { icon: MembersIcon, accent: 'var(--accent-members)', key: 'members', soon: true },
];

// i18n key prefix per checklist step: 'keys' -> gsKeys*, 'prompt' -> gsPrompt*, …
const GS_LABEL: Record<string, string> = {
  keys: 'Keys',
  prompt: 'Prompt',
  pipeline: 'Pipeline',
  project: 'Project',
};

function collapseKey(wsId: string) {
  return `lyra:gs-collapsed:${wsId}`;
}

export function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;

  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [resent, setResent] = useState(false);
  const unverified = user?.emailVerified === false;

  // Pull the four workspace counts that drive the Get-started checklist. Each
  // call is best-effort (a failure just reads as "0 / not done yet") so the hub
  // always renders even if one endpoint is unavailable.
  useEffect(() => {
    if (!wsId) {
      setStats(null);
      return;
    }
    setCollapsed(localStorage.getItem(collapseKey(wsId)) === '1');
    let cancelled = false;
    Promise.all([
      api<ApiKeyInfo[]>(`/workspaces/${wsId}/keys`).catch(() => [] as ApiKeyInfo[]),
      api<Paged<Prompt>>(`/workspaces/${wsId}/prompts?limit=1`).catch(
        () => ({ items: [], total: 0, page: 1, limit: 1 }) as Paged<Prompt>,
      ),
      api<Pipeline[]>(`/workspaces/${wsId}/pipelines`).catch(() => [] as Pipeline[]),
      api<Project[]>(`/workspaces/${wsId}/projects`).catch(() => [] as Project[]),
    ]).then(([keys, prompts, pipelines, projects]) => {
      if (cancelled) return;
      setStats({
        keys: keys.length,
        prompts: prompts.total ?? 0,
        pipelines: pipelines.length,
        projects: projects.length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      if (wsId) localStorage.setItem(collapseKey(wsId), next ? '1' : '0');
      return next;
    });
  }

  function resendVerification() {
    api<{ ok: boolean }>('/auth/resend-verification', { method: 'POST' })
      .then(() => setResent(true))
      .catch(() => setResent(true)); // always show "sent" (never reveal account state)
  }

  const steps = stats ? gettingStartedSteps(stats) : [];
  const progress = gettingStartedProgress(steps);
  const showGetStarted = !!stats && !progress.complete;

  return (
    <div>
      <div className="home-head">
        <h2>{t('home.greeting', { name: user?.name?.split(' ')[0] ?? '' })}</h2>
        <p>
          {current
            ? t('home.workspaceMeta', {
                name: current.name,
                type: current.type,
                role: current.role,
              })
            : t('home.noWorkspace')}
        </p>
      </div>

      {unverified && (
        <div className="gs-verify">
          <div className="gs-verify-text">
            <strong>{t('home.confirmEmailTitle')}</strong>
            <span>{t('home.confirmEmailBody', { email: user?.email ?? '' })}</span>
          </div>
          <button className="gs-verify-btn" onClick={resendVerification} disabled={resent}>
            {resent ? t('home.confirmEmailSent') : t('home.confirmEmailResend')}
          </button>
        </div>
      )}

      {showGetStarted && (
        <section className="gs-card" aria-label={t('home.gsTitle')}>
          <div className="gs-head">
            <div className="gs-head-text">
              <h3 className="gs-title">{t('home.gsTitle')}</h3>
              <p className="gs-sub">{t('home.gsSubtitle')}</p>
            </div>
            <div className="gs-progress">
              <span className="gs-progress-label">
                {t('home.gsProgress', { done: progress.done, total: progress.total })}
              </span>
              <div className="gs-bar" role="presentation">
                <div className="gs-bar-fill" style={{ width: `${progress.ratio * 100}%` }} />
              </div>
            </div>
            <IconButton
              icon={
                <ChevronIcon
                  width={16}
                  height={16}
                  style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s ease' }}
                />
              }
              label={t(collapsed ? 'home.gsExpand' : 'home.gsCollapse')}
              size="sm"
              onClick={toggleCollapse}
            />
          </div>

          {!collapsed && (
          <ol className="gs-steps">
            {steps.map((step, i) => {
              const active = i === progress.activeIndex;
              const label = GS_LABEL[step.key];
              const cls = `gs-step${step.done ? ' done' : ''}${active ? ' active' : ''}`;
              return (
                <li key={step.key} className={cls}>
                  <span className="gs-step-mark" aria-hidden>
                    {step.done ? <CheckIcon width={14} height={14} /> : i + 1}
                  </span>
                  <div className="gs-step-body">
                    <span className="gs-step-title">{t(`home.gs${label}Title`)}</span>
                    <span className="gs-step-desc">{t(`home.gs${label}Body`)}</span>
                  </div>
                  {step.done ? (
                    <span className="gs-step-done">{t('home.gsStepDone')}</span>
                  ) : (
                    <Link
                      to={step.to}
                      className={`icon-button ${active ? 'ib-primary' : 'ib-default'} ib-sm gs-step-cta`}
                      title={t(`home.gs${label}Cta`)}
                      aria-label={t(`home.gs${label}Cta`)}
                    >
                      <PlusIcon width={14} height={14} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
          )}
        </section>
      )}

      <div className="panel-grid">
        {TILES.map((tile) => {
          const inner = (
            <>
              <div
                className="panel-ico"
                style={{
                  color: tile.accent,
                  background: `color-mix(in srgb, ${tile.accent} 9%, transparent)`,
                }}
              >
                <tile.icon width={20} height={20} />
              </div>
              <h3>
                {t(`home.${tile.key}Title`)}
                {tile.soon && <span className="soon">{t('home.soon')}</span>}
              </h3>
              <p>{t(`home.${tile.key}Body`)}</p>
              {tile.cta && <span className="panel-go">{t(`home.${tile.key}Cta`)} →</span>}
            </>
          );
          return tile.to ? (
            <Link key={tile.key} to={tile.to} className="panel panel-link">
              {inner}
            </Link>
          ) : (
            <div key={tile.key} className="panel panel-soon">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
