import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import {
  ProjectsIcon,
  PromptsIcon,
  ChatsIcon,
  PipelinesIcon,
  SettingsIcon,
  MembersIcon,
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

export function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();

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
