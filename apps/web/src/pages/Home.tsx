import { Link } from 'react-router-dom';
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
  title: string;
  body: string;
  cta?: string;
  soon?: boolean;
}

const TILES: Tile[] = [
  {
    to: '/chats',
    icon: ChatsIcon,
    accent: '#f59e0b',
    title: 'Chats',
    body: 'Where you craft prompts. Chat multi-turn with any provider·model, compare answers side by side, and when a prompt lands, save it straight to your library. Every turn is kept automatically.',
    cta: 'Start chatting',
  },
  {
    to: '/prompts',
    icon: PromptsIcon,
    accent: '#14b8a6',
    title: 'Prompts',
    body: 'Your library of the keepers — reusable, on-brand prompts with media, tags, and {placeholders}. Open any prompt back in a chat to keep iterating, or wire it into a pipeline step.',
    cta: 'Open prompts',
  },
  {
    to: '/pipelines',
    icon: PipelinesIcon,
    accent: '#5e6ad2',
    title: 'Pipelines',
    body: 'Compose linear flows of steps — each step binds a prompt to a provider·model with gate or auto mode. Assign a pipeline to a project and run it; the flow lights up step by step, pausing at gates for approval.',
    cta: 'Open pipelines',
  },
  {
    to: '/projects',
    icon: ProjectsIcon,
    accent: '#0ea5e9',
    title: 'Projects',
    body: 'A project per brand, product, or store. It supplies the run context ({product}, {niche}, {homepage}) and is where you assign pipelines and launch runs.',
    cta: 'Open projects',
  },
  {
    to: '/settings',
    icon: SettingsIcon,
    accent: '#7c5cff',
    title: 'Provider keys',
    body: 'Bring your own provider keys per workspace, encrypted at rest (AES-256-GCM). A step is runnable only once its provider’s key is set — no keys ever leave the server.',
    cta: 'Manage keys',
  },
  {
    icon: MembersIcon,
    accent: '#ec4899',
    title: 'Members',
    body: 'Invite teammates by email and manage their roles. Use the workspace menu (top-left) to switch between or create new workspaces.',
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
