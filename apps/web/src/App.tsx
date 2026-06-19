import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth/useAuth';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { MatrixRain } from './components/MatrixRain';
import { Landing } from './pages/Landing';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { ProjectEditor } from './pages/ProjectEditor';
import { Prompts } from './pages/Prompts';
import { PromptEditor } from './pages/PromptEditor';
import { Marketplace } from './pages/Marketplace';
import { Chats } from './pages/Chats';
import { Pipelines } from './pages/Pipelines';
import { PipelineBuilder } from './pages/PipelineBuilder';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Connections } from './pages/Connections';
import { PublishComposer } from './pages/PublishComposer';
import { ImportMedia } from './pages/ImportMedia';
import { Members } from './pages/Members';
import { AppLayout } from './layout/AppLayout';

function Loading() {
  const { t } = useTranslation();
  return <div className="center muted">{t('common.loading')}</div>;
}

// Root gate: logged-out visitors get the public marketing landing at `/` and a
// login redirect for any deeper app path; logged-in users get the app shell
// (one AppLayout instance across all app routes — no remount between pages).
function RootGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) {
    return location.pathname === '/' ? <Landing /> : <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

// Keeps logged-in users out of /login and /signup.
function PublicOnlyLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (user && location.pathname !== '/reset-password') return <Navigate to="/" replace />;
  return (
    <>
      <MatrixRain />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicOnlyLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
    ],
  },
  {
    path: '/',
    element: <RootGate />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/new', element: <ProjectEditor /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'projects/:id/edit', element: <ProjectEditor /> },
      { path: 'prompts', element: <Prompts /> },
      { path: 'prompts/new', element: <PromptEditor /> },
      { path: 'prompts/:id', element: <PromptEditor /> },
      { path: 'marketplace', element: <Marketplace /> },
      { path: 'chats', element: <Chats /> },
      { path: 'chats/:id', element: <Chats /> },
      { path: 'pipelines', element: <Pipelines /> },
      { path: 'pipelines/new', element: <PipelineBuilder /> },
      { path: 'pipelines/:id', element: <PipelineBuilder /> },
      { path: 'publish', element: <PublishComposer /> },
      { path: 'import', element: <ImportMedia /> },
      { path: 'connections', element: <Connections /> },
      { path: 'members', element: <Members /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
