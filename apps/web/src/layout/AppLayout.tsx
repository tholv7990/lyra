import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { WorkspaceMenu } from './WorkspaceMenu';
import { BreadcrumbContext, AppNavContext, type BreadcrumbState } from './breadcrumb';
import {
  HomeIcon,
  ProjectsIcon,
  PromptsIcon,
  ChatsIcon,
  PipelinesIcon,
  MembersIcon,
  SettingsIcon,
  LogoutIcon,
} from './icons';
import './layout.css';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Top-level sections. The breadcrumb derives the module from the current path;
// detail pages add the record name via useBreadcrumb().
const MODULES = [
  { path: '/chats', name: 'Chats' },
  { path: '/prompts', name: 'Prompts' },
  { path: '/pipelines', name: 'Pipelines' },
  { path: '/projects', name: 'Projects' },
  { path: '/settings', name: 'Settings' },
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
              <img className="brand-full" src="/lyra-logo-horizontal-light.svg" alt="Lyra" />
              <img className="brand-mark" src="/lyra-mark-squircle.svg" alt="Lyra" />
            </button>
            <button className="brand-close" onClick={close} aria-label="Close menu">
              ✕
            </button>
          </div>

          <WorkspaceMenu />

          <nav className="sidebar-nav">
            <NavLink to="/" end title="Home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <HomeIcon />
              <span className="nav-txt">Home</span>
            </NavLink>
            <NavLink to="/chats" title="Chats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <ChatsIcon />
              <span className="nav-txt">Chats</span>
            </NavLink>
            <NavLink to="/prompts" title="Prompts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <PromptsIcon />
              <span className="nav-txt">Prompts</span>
            </NavLink>
            <NavLink to="/pipelines" title="Pipelines" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <PipelinesIcon />
              <span className="nav-txt">Pipelines</span>
            </NavLink>
            <NavLink to="/projects" title="Projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <ProjectsIcon />
              <span className="nav-txt">Projects</span>
            </NavLink>
            <div className="nav-item disabled" title="Members (soon)">
              <MembersIcon />
              <span className="nav-txt">Members</span>
              <span className="soon">Soon</span>
            </div>
            <NavLink to="/settings" title="Settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={close}>
              <SettingsIcon />
              <span className="nav-txt">Settings</span>
            </NavLink>
          </nav>

          <div className="sidebar-spacer" />

          <div className="sidebar-user">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="meta">
              <div className="name">{user?.name}</div>
              <div className="email">{user?.email}</div>
            </div>
          </div>
          <button className="nav-item" title="Sign out" onClick={() => void logout()}>
            <LogoutIcon />
            <span className="nav-txt">Sign out</span>
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
                  <Link to={crumb.parent?.to ?? mod.path} className="bc-back" aria-label={`Back to ${crumb.parent?.label ?? mod.name}`}>
                    ‹
                  </Link>
                  <Link to={crumb.parent?.to ?? mod.path} className="bc-module">
                    {crumb.parent?.label ?? mod.name}
                  </Link>
                  <span className="bc-sep">/</span>
                  <span className="bc-record">{crumb.record ?? '…'}</span>
                </>
              ) : (
                <span className="bc-current">{mod.name}</span>
              )}
            </nav>
          </header>
          <div className="content">
            <Outlet />
          </div>
        </div>
      </div>
     </AppNavContext.Provider>
    </BreadcrumbContext.Provider>
  );
}
