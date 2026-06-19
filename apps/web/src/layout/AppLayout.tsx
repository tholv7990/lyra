import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../workspace/useWorkspace';
import { initials } from '../lib/format';
import { BrandLogo } from '../components/BrandLogo';
import { ThemeToggleButton, LanguageToggleButton } from '../components/PrefControls';
import { WorkspaceMenu } from './WorkspaceMenu';
import { NotificationBell } from './NotificationBell';
import { BreadcrumbContext, AppNavContext, type BreadcrumbState } from './breadcrumb';
import {
  HomeIcon,
  ProjectsIcon,
  PromptsIcon,
  MarketplaceIcon,
  ChatsIcon,
  PipelinesIcon,
  MembersIcon,
  SettingsIcon,
  LogoutIcon,
  PublishIcon,
  ImportIcon,
  ConnectionsIcon,
  AdminIcon,
} from './icons';
import './layout.css';

// Top-level sections. The breadcrumb derives the module from the current path;
// detail pages add the record name via useBreadcrumb().
const MODULES = [
  { path: '/chats', name: 'Chats' },
  { path: '/prompts', name: 'Prompts' },
  { path: '/marketplace', name: 'Marketplace' },
  { path: '/pipelines', name: 'Pipelines' },
  { path: '/projects', name: 'Projects' },
  { path: '/publish', name: 'Publish' },
  { path: '/import', name: 'Import media' },
  { path: '/connections', name: 'Connections' },
  { path: '/members', name: 'Members' },
  { path: '/settings', name: 'Settings' },
  { path: '/admin', name: 'Admin' },
];
function moduleFor(pathname: string) {
  return (
    MODULES.find((m) => pathname === m.path || pathname.startsWith(`${m.path}/`)) ?? {
      path: '/',
      name: 'Home',
    }
  );
}

const COLLAPSE_KEY = 'lyra.nav.collapsed';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  const [crumb, setCrumb] = useState<BreadcrumbState>({ record: null, parent: null });

  const close = () => setOpen(false);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });

  const mod = moduleFor(location.pathname);
  // Translate the breadcrumb module label to match the (translated) sidebar.
  const NAV_KEY: Record<string, string> = {
    '/': 'nav.home',
    '/chats': 'nav.chats',
    '/prompts': 'nav.prompts',
    '/marketplace': 'nav.marketplace',
    '/pipelines': 'nav.pipelines',
    '/projects': 'nav.projects',
    '/publish': 'nav.publish',
    '/import': 'nav.import',
    '/connections': 'nav.connections',
    '/members': 'nav.members',
    '/settings': 'nav.settings',
    '/admin': 'nav.admin',
  };
  const modLabel = t(NAV_KEY[mod.path] ?? '', { defaultValue: mod.name });
  // A path under a module is a detail view; so is any page that set a parent
  // override (e.g. a chat opened from a prompt, before it gets its own /chats/:id).
  const isDetail =
    (mod.path !== '/' && location.pathname !== mod.path) || !!crumb.parent;

  return (
    <BreadcrumbContext.Provider value={setCrumb}>
     <AppNavContext.Provider value={() => setOpen(true)}>
      <div className={`app ${collapsed ? 'nav-collapsed' : ''}`}>
        {open && <div className="scrim" onClick={close} />}

        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand">
            <button
              className="brand-btn"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <BrandLogo className="brand-full" />
              <img className="brand-mark" src="/lyra-mark-squircle.svg" alt="Lyra" />
            </button>
            <button className="brand-close" onClick={close} aria-label="Close menu">
              ✕
            </button>
          </div>

          <nav className="sidebar-nav">
            <NavLink to="/" end title={t('nav.home')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <HomeIcon />
              <span className="nav-txt">{t('nav.home')}</span>
            </NavLink>
            <NavLink to="/marketplace" title={t('nav.marketplace')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <MarketplaceIcon />
              <span className="nav-txt">{t('nav.marketplace')}</span>
            </NavLink>

            {/* Workspace group: the switcher heads its scoped resources. */}
            <div className="nav-group-label">{t('nav.workspace')}</div>
            <WorkspaceMenu />
            <NavLink to="/prompts" title={t('nav.prompts')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <PromptsIcon />
              <span className="nav-txt">{t('nav.prompts')}</span>
            </NavLink>
            <NavLink to="/pipelines" title={t('nav.pipelines')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <PipelinesIcon />
              <span className="nav-txt">{t('nav.pipelines')}</span>
            </NavLink>
            <NavLink to="/projects" title={t('nav.projects')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <ProjectsIcon />
              <span className="nav-txt">{t('nav.projects')}</span>
            </NavLink>

            <div className="nav-group-label">{t('nav.builtins')}</div>
            <NavLink to="/publish" title={t('nav.publish')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <PublishIcon />
              <span className="nav-txt">{t('nav.publish')}</span>
            </NavLink>
            <NavLink to="/import" title={t('nav.import')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <ImportIcon />
              <span className="nav-txt">{t('nav.import')}</span>
            </NavLink>
            <NavLink to="/connections" title={t('nav.connections')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <ConnectionsIcon />
              <span className="nav-txt">{t('nav.connections')}</span>
            </NavLink>

            {current?.type === 'team' && (
              <NavLink to="/members" title={t('nav.members')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
                <MembersIcon />
                <span className="nav-txt">{t('nav.members')}</span>
              </NavLink>
            )}
            <NavLink to="/settings" title={t('nav.settings')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <SettingsIcon />
              <span className="nav-txt">{t('nav.settings')}</span>
            </NavLink>
            {user?.isAdmin && (
              <NavLink to="/admin" title={t('nav.admin')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
                <AdminIcon />
                <span className="nav-txt">{t('nav.admin')}</span>
              </NavLink>
            )}
          </nav>

          <div className="sidebar-spacer" />

          <div className="sidebar-user">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="meta">
              <div className="name">{user?.name}</div>
              <div className="email">{user?.email}</div>
            </div>
          </div>
          <button
            className="nav-item"
            title={t('nav.logout')}
            onClick={() => {
              // Land on the public homepage (Landing), not /login. Navigate to '/'
              // first so when `user` clears we are already on the route that
              // renders Landing for logged-out visitors.
              navigate('/');
              void logout();
            }}
          >
            <LogoutIcon />
            <span className="nav-txt">{t('nav.logout')}</span>
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <button
              className="topbar-menu"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <img src="/lyra-mark-squircle.svg" alt="Menu" />
            </button>
            <nav className="breadcrumb">
              {isDetail ? (
                <>
                  <Link to={crumb.parent?.to ?? mod.path} className="bc-back" aria-label={`Back to ${crumb.parent?.label ?? modLabel}`}>
                    ‹
                  </Link>
                  <Link to={crumb.parent?.to ?? mod.path} className="bc-module">
                    {crumb.parent?.label ?? modLabel}
                  </Link>
                  <span className="bc-sep">/</span>
                  <span className="bc-record">{crumb.record ?? '…'}</span>
                </>
              ) : (
                <span className="bc-current">{modLabel}</span>
              )}
            </nav>
            <div className="topbar-actions">
              <NotificationBell />
              <LanguageToggleButton />
              <ThemeToggleButton />
            </div>
          </header>
          <div className="content">
            <Outlet />
          </div>
        </div>

        {/* Floating AI launcher — opens Chats from anywhere (hidden while in Chats). */}
        {!location.pathname.startsWith('/chats') && (
          <button
            className="ai-fab"
            onClick={() => { close(); navigate('/chats'); }}
            title={t('nav.chats')}
            aria-label={t('nav.chats')}
          >
            <ChatsIcon />
            <span className="ai-fab-txt">{t('nav.aiButton')}</span>
          </button>
        )}
      </div>
     </AppNavContext.Provider>
    </BreadcrumbContext.Provider>
  );
}
