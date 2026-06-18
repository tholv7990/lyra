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
  SettingsIcon,
  MembersIcon,
  CheckIcon,
  XIcon,
} from '../layout/icons';

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
  { to: '/prompts', icon: PromptsIcon, accent: 'var(--accent-prompts)', key: 'prompts', cta: true },
  { to: '/pipelines', icon: PipelinesIcon, accent: 'var(--accent-pipelines)', key: 'pipelines', cta: true },
  { to: '/projects', icon: ProjectsIcon, accent: 'var(--accent-projects)', key: 'projects', cta: true },
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

function dismissKey(wsId: string) {
  return `lyra:gs-dismissed:${wsId}`;
}

export function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id;

  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Pull the four workspace counts that drive the Get-started checklist. Each
  // call is best-effort (a failure just reads as "0 / not done yet") so the hub
  // always renders even if one endpoint is unavailable.
  useEffect(() => {
    if (!wsId) {
      setStats(null);
      return;
    }
    setDismissed(localStorage.getItem(dismissKey(wsId)) === '1');
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

  function dismiss() {
    if (wsId) localStorage.setItem(dismissKey(wsId), '1');
    setDismissed(true);
  }

  const steps = stats ? gettingStartedSteps(stats) : [];
  const progress = gettingStartedProgress(steps);
  const showGetStarted = !!stats && !dismissed && !progress.complete;

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
            <button className="gs-dismiss" onClick={dismiss} title={t('home.gsDismiss')} aria-label={t('home.gsDismiss')}>
              <XIcon width={15} height={15} />
            </button>
          </div>

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
                      className={`${active ? 'btn-primary' : 'btn-ghost'} btn-sm gs-step-cta`}
                    >
                      {t(`home.gs${label}Cta`)}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
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
