import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import {
  ProjectsIcon,
  PromptsIcon,
  SettingsIcon,
  MembersIcon,
} from '../layout/icons';

interface Tile {
  to?: string;
  icon: typeof ProjectsIcon;
  accent: string;
  title: string;
  body: string;
  cta?: string;
  soon?: boolean;
}

const TILES: Tile[] = [
  {
    to: '/projects',
    icon: ProjectsIcon,
    accent: '#5e6ad2',
    title: 'Projects',
    body: 'Create a project per brand or store, then run the 8-step pipeline against it.',
    cta: 'Open projects',
  },
  {
    to: '/prompts',
    icon: PromptsIcon,
    accent: '#14b8a6',
    title: 'Prompt library',
    body: 'Save reusable, on-brand prompts per step — with media — and share them with your team.',
    cta: 'Open prompts',
  },
  {
    to: '/settings',
    icon: SettingsIcon,
    accent: '#7c5cff',
    title: 'Provider keys',
    body: 'Bring your own keys per workspace, encrypted at rest. Each step unlocks with its provider.',
    cta: 'Manage keys',
  },
  {
    icon: MembersIcon,
    accent: '#ec4899',
    title: 'Members',
    body: 'Invite teammates by email and manage roles. Use the workspace menu to switch or create teams.',
    soon: true,
  },
];

export function Home() {
  const { user } = useAuth();
  const { current } = useWorkspace();

  return (
    <div>
      <div className="home-head">
        <h2>Good to see you, {user?.name?.split(' ')[0]}</h2>
        <p>
          {current
            ? `${current.name} · ${current.type} workspace · you're ${current.role}`
            : 'No workspace selected.'}
        </p>
      </div>

      <div className="panel-grid">
        {TILES.map((t) => {
          const inner = (
            <>
              <div
                className="panel-ico"
                style={{ color: t.accent, background: `${t.accent}16` }}
              >
                <t.icon width={20} height={20} />
              </div>
              <h3>
                {t.title}
                {t.soon && <span className="soon">Soon</span>}
              </h3>
              <p>{t.body}</p>
              {t.cta && <span className="panel-go">{t.cta} →</span>}
            </>
          );
          return t.to ? (
            <Link key={t.title} to={t.to} className="panel panel-link">
              {inner}
            </Link>
          ) : (
            <div key={t.title} className="panel panel-soon">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
