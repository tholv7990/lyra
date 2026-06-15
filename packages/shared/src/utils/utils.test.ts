import { describe, it, expect } from 'vitest';
import {
  canViewProject,
  canEditProject,
  canManageKeys,
  fillPrompt,
  type MemberCtx,
} from './index';
import { Role, ProjectVisibility } from '../enums';

const owner: MemberCtx = { userId: 'u-owner', role: Role.Owner, canManageKeys: false };
const member: MemberCtx = { userId: 'u-member', role: Role.Member, canManageKeys: false };
const other: MemberCtx = { userId: 'u-other', role: Role.Member, canManageKeys: false };

function project(overrides: Partial<{ createdBy: string; visibility: ProjectVisibility; sharedWith: string[] }>) {
  return {
    createdBy: 'u-member',
    visibility: ProjectVisibility.Private,
    sharedWith: [] as string[],
    ...overrides,
  };
}

describe('canViewProject', () => {
  it('owner sees everything (override), even other members private projects', () => {
    expect(canViewProject(project({ createdBy: 'u-member', visibility: ProjectVisibility.Private }), owner)).toBe(true);
  });

  it('creator sees their own private project', () => {
    expect(canViewProject(project({ createdBy: 'u-member', visibility: ProjectVisibility.Private }), member)).toBe(true);
  });

  it('non-creator cannot see a private project', () => {
    expect(canViewProject(project({ createdBy: 'u-member', visibility: ProjectVisibility.Private }), other)).toBe(false);
  });

  it('any member sees a workspace-visible project', () => {
    expect(canViewProject(project({ createdBy: 'u-member', visibility: ProjectVisibility.Workspace }), other)).toBe(true);
  });

  it('shared project is visible only to named users', () => {
    const p = project({ createdBy: 'u-member', visibility: ProjectVisibility.Shared, sharedWith: ['u-other'] });
    expect(canViewProject(p, other)).toBe(true);
    expect(canViewProject(project({ createdBy: 'u-member', visibility: ProjectVisibility.Shared, sharedWith: ['someone-else'] }), other)).toBe(false);
  });
});

describe('canEditProject', () => {
  it('owner can edit any project', () => {
    expect(canEditProject({ createdBy: 'u-member' }, owner)).toBe(true);
  });
  it('creator can edit their own project', () => {
    expect(canEditProject({ createdBy: 'u-member' }, member)).toBe(true);
  });
  it('non-creator member cannot edit', () => {
    expect(canEditProject({ createdBy: 'u-member' }, other)).toBe(false);
  });
});

describe('canManageKeys', () => {
  it('owner can always manage keys', () => {
    expect(canManageKeys(owner)).toBe(true);
  });
  it('member can manage keys only when delegated', () => {
    expect(canManageKeys(member)).toBe(false);
    expect(canManageKeys({ ...member, canManageKeys: true })).toBe(true);
  });
});

describe('fillPrompt', () => {
  it('substitutes provided variables', () => {
    expect(fillPrompt('Find ads for {product} in {niche}', { product: 'Runner X', niche: 'footwear' })).toBe(
      'Find ads for Runner X in footwear',
    );
  });
  it('leaves the placeholder when a variable is missing or blank', () => {
    expect(fillPrompt('Homepage: {homepage}', {})).toBe('Homepage: {homepage}');
    expect(fillPrompt('Homepage: {homepage}', { homepage: '   ' })).toBe('Homepage: {homepage}');
  });
  it('replaces all occurrences of a placeholder', () => {
    expect(fillPrompt('{product} {product}', { product: 'A' })).toBe('A A');
  });
});
