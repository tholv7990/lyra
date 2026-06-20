import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { WorkspaceType, Role } from '@lyra/shared';
import type { WorkspaceView } from '@lyra/shared';

// Stub i18n — return the key so assertions match key names.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        return Object.entries(opts).reduce<string>(
          (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
          key,
        );
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// Stub auth.
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Alice' } }),
}));

// Stub api — never called during static render.
vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue([]),
}));

// Mutable slot so individual tests can swap the workspace type.
let _wsType: WorkspaceType = WorkspaceType.Personal;

vi.mock('../workspace/useWorkspace', () => ({
  useWorkspace: () => {
    const actor = { id: 'user-1', name: 'Alice' };
    const ws: WorkspaceView = {
      id: 'ws-1',
      name: 'My Workspace',
      type: _wsType,
      role: Role.Owner,
      canManageKeys: true,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: actor,
      updatedBy: actor,
    };
    return {
      current: ws,
      workspaces: [ws],
      setCurrent: vi.fn(),
      refresh: vi.fn(),
      loading: false,
    };
  },
}));

import { Members } from './Members';

function render() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Members />
    </MemoryRouter>,
  );
}

describe('Members page', () => {
  test('personal workspace renders the upgrade prompt, not the member table', () => {
    _wsType = WorkspaceType.Personal;
    const html = render();
    expect(html).toContain('members.upgradeTitle');
    expect(html).toContain('members.upgradeCta');
    // Should not render the live members table header
    expect(html).not.toContain('members.peopleCount');
  });

  test('team workspace renders the members UI, not the upgrade prompt', () => {
    _wsType = WorkspaceType.Team;
    const html = render();
    expect(html).not.toContain('members.upgradeTitle');
    // Members UI renders the search toolbar and invite button
    expect(html).toContain('members.searchPlaceholder');
    expect(html).toContain('members.invite');
  });
});
