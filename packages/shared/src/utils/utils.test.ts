import { describe, it, expect } from 'vitest';
import {
  canViewProject,
  canEditProject,
  canManageKeys,
  fillPrompt,
  normalizeTag,
  tagKey,
  dedupeTags,
  tagColor,
  mediaTypeForMime,
  isAllowedMedia,
  type MemberCtx,
} from './index';
import { MediaType } from '../enums';
import { Role, ProjectVisibility } from '../enums';
import { TAG_MAX, TAG_MAX_LEN, TAG_PALETTE } from '../constants/tags';

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

describe('normalizeTag', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeTag('  summer   sale ')).toBe('summer sale');
  });
  it('caps length', () => {
    expect(normalizeTag('x'.repeat(50))).toHaveLength(TAG_MAX_LEN);
  });
  it('preserves casing for display', () => {
    expect(normalizeTag('Hero Shot')).toBe('Hero Shot');
  });
});

describe('tagKey', () => {
  it('is the lowercased normalized form', () => {
    expect(tagKey(' Hero ')).toBe('hero');
    expect(tagKey('SUMMER  Sale')).toBe('summer sale');
  });
});

describe('dedupeTags', () => {
  it('dedupes case-insensitively, keeping first-seen casing', () => {
    expect(dedupeTags(['Hero', 'hero', 'HERO'])).toEqual(['Hero']);
  });
  it('drops blanks and normalizes each', () => {
    expect(dedupeTags(['  ', 'a ', ' a', 'b'])).toEqual(['a', 'b']);
  });
  it('caps the count', () => {
    const many = Array.from({ length: TAG_MAX + 5 }, (_, i) => `t${i}`);
    expect(dedupeTags(many)).toHaveLength(TAG_MAX);
  });
});

describe('tagColor', () => {
  it('is deterministic and case-insensitive', () => {
    expect(tagColor('Hero')).toBe(tagColor('hero'));
  });
  it('returns a color from the palette', () => {
    expect(TAG_PALETTE).toContain(tagColor('anything'));
  });
});

describe('mediaTypeForMime', () => {
  it('buckets by MIME prefix, defaulting to File', () => {
    expect(mediaTypeForMime('image/png')).toBe(MediaType.Image);
    expect(mediaTypeForMime('audio/mpeg')).toBe(MediaType.Audio);
    expect(mediaTypeForMime('video/mp4')).toBe(MediaType.Video);
    expect(mediaTypeForMime('application/pdf')).toBe(MediaType.File);
  });
});

describe('isAllowedMedia', () => {
  it('allows known MIME types', () => {
    expect(isAllowedMedia('application/pdf', 'spec.pdf')).toBe(true);
    expect(isAllowedMedia('image/webp', 'a.webp')).toBe(true);
  });
  it('falls back to the extension for blank/odd MIMEs', () => {
    expect(isAllowedMedia('', 'notes.md')).toBe(true);
    expect(isAllowedMedia('application/octet-stream', 'data.csv')).toBe(true);
  });
  it('rejects disallowed files', () => {
    expect(isAllowedMedia('application/x-msdownload', 'virus.exe')).toBe(false);
  });
});
