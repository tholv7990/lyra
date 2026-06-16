import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';

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
        <div className="panel">
          <h3>
            Projects
            <span className="soon">Soon</span>
          </h3>
          <p>Create a project per brand or store, then run the pipeline against it.</p>
        </div>
        <div className="panel">
          <h3>
            Pipeline
            <span className="soon">Soon</span>
          </h3>
          <p>The 8-step workbench: find → crawl → brief → insight → prompts → images → video → QA.</p>
        </div>
        <div className="panel">
          <h3>
            Provider keys
            <span className="soon">Soon</span>
          </h3>
          <p>Bring your own keys per workspace, encrypted at rest. Each step unlocks with its provider.</p>
        </div>
        <div className="panel">
          <h3>
            Members
            <span className="soon">Soon</span>
          </h3>
          <p>Invite teammates by email and manage roles. Use the workspace menu to switch or create teams.</p>
        </div>
      </div>
    </div>
  );
}
