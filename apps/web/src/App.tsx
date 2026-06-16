import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { ProjectEditor } from './pages/ProjectEditor';
import { Prompts } from './pages/Prompts';
import { PromptEditor } from './pages/PromptEditor';
import { PromptPlayground } from './pages/PromptPlayground';
import { Pipelines } from './pages/Pipelines';
import { PipelineCreate } from './pages/PipelineCreate';
import { PipelineBuilder } from './pages/PipelineBuilder';
import { Settings } from './pages/Settings';
import { AppLayout } from './layout/AppLayout';

function Loading() {
  return <div className="center muted">Loading…</div>;
}

// Guards the app shell — redirects to /login when there's no session.
function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

// Keeps logged-in users out of /login and /signup.
function PublicOnlyLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <PublicOnlyLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
    ],
  },
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/projects', element: <Projects /> },
      { path: '/projects/new', element: <ProjectEditor /> },
      { path: '/projects/:id', element: <ProjectDetail /> },
      { path: '/projects/:id/edit', element: <ProjectEditor /> },
      { path: '/prompts', element: <Prompts /> },
      { path: '/prompts/new', element: <PromptEditor /> },
      { path: '/prompts/:id/edit', element: <PromptEditor /> },
      { path: '/prompts/:id/test', element: <PromptPlayground /> },
      { path: '/pipelines', element: <Pipelines /> },
      { path: '/pipelines/new', element: <PipelineCreate /> },
      { path: '/pipelines/:id', element: <PipelineBuilder /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
