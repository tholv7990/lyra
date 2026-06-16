import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { WorkspaceMenu } from './WorkspaceMenu';
import {
  HomeIcon,
  ProjectsIcon,
  MembersIcon,
  SettingsIcon,
  MenuIcon,
  LogoutIcon,
} from './icons';
import './layout.css';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/projects': 'Projects',
  '/settings': 'Settings',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const title = TITLES[location.pathname] ?? 'Lyra';

  return (
    <div className="app">
      {open && <div className="scrim" onClick={close} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <WorkspaceMenu />

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={close}
          >
            <HomeIcon />
            Home
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={close}
          >
            <ProjectsIcon />
            Projects
          </NavLink>
          <div className="nav-item disabled">
            <MembersIcon />
            Members
            <span className="soon">Soon</span>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={close}
          >
            <SettingsIcon />
            Settings
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
        <button className="nav-item" onClick={() => void logout()}>
          <LogoutIcon />
          Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-toggle"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <h1>{title}</h1>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
