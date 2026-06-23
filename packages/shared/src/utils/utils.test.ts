import { describe, it, expect } from 'vitest';
import {
  canViewProject,
  canEditProject,
  canManageKeys,
  canCreate,
  evalCondition,
  fillPrompt,
  resolveStepRefs,
  promptVarsForStep,
  unknownStepRefs,
  normalizeTag,
  tagKey,
  dedupeTags,
  tagColor,
  labelColor,
  mediaTypeForMime,
  isAllowedMedia,
  parsePromptVariables,
  toLyraPlaceholders,
  isActionStep,
  computeAdDiff,
  parseImageRefs,
  keyProviderFor,
  providerNeedsKey,
  isNetscapeCookies,
  fallbackChain,
  type MemberCtx,
} from './index';
import { MediaType, Provider, StepKind } from '../enums';
import {
  MODEL_CATALOG,
  isModelAllowed,
  defaultModel,
  looksLikeModelId,
} from '../constants/models';
import { Role, ProjectStatus, ProjectShare } from '../enums';
import { TAG_MAX, TAG_MAX_LEN, TAG_PALETTE } from '../constants/tags';

const owner: MemberCtx = { userId: 'u-owner', role: Role.Owner, canManageKeys: false };
const member: MemberCtx = { userId: 'u-member', role: Role.Member, canManageKeys: false };
const other: MemberCtx = { userId: 'u-other', role: Role.Member, canManageKeys: false };
const viewer: MemberCtx = { userId: 'u-viewer', role: Role.Viewer, canManageKeys: false };

describe('canCreate', () => {
  it('lets owners and members create, but not viewers', () => {
    expect(canCreate(owner)).toBe(true);
    expect(canCreate(member)).toBe(true);
    expect(canCreate(viewer)).toBe(false);
  });
});

describe('canEditProject — viewer is read-only', () => {
  it('denies a viewer even on content they created', () => {
    expect(canEditProject({ createdBy: 'u-viewer' }, viewer)).toBe(false);
    expect(canEditProject({ createdBy: 'u-member' }, viewer)).toBe(false);
  });
});

function project(
  overrides: Partial<{ createdBy: string; status: ProjectStatus; shared: ProjectShare; sharedWith: string[] }>,
) {
  return {
    createdBy: 'u-member',
    status: ProjectStatus.Draft,
    shared: ProjectShare.All,
    sharedWith: [] as string[],
    ...overrides,
  };
}

describe('canViewProject', () => {
  it('owner sees everything (override), even other members draft projects', () => {
    expect(canViewProject(project({ createdBy: 'u-member', status: ProjectStatus.Draft }), owner)).toBe(true);
  });

  it('creator sees their own draft project', () => {
    expect(canViewProject(project({ createdBy: 'u-member', status: ProjectStatus.Draft }), member)).toBe(true);
  });

  it('non-creator cannot see a draft project', () => {
    expect(canViewProject(project({ createdBy: 'u-member', status: ProjectStatus.Draft }), other)).toBe(false);
  });

  it('any member sees a public project shared with all', () => {
    const p = project({ createdBy: 'u-member', status: ProjectStatus.Public, shared: ProjectShare.All });
    expect(canViewProject(p, other)).toBe(true);
  });

  it('public + people is visible only to named users', () => {
    const p = project({ createdBy: 'u-member', status: ProjectStatus.Public, shared: ProjectShare.People, sharedWith: ['u-other'] });
    expect(canViewProject(p, other)).toBe(true);
    expect(
      canViewProject(
        project({ createdBy: 'u-member', status: ProjectStatus.Public, shared: ProjectShare.People, sharedWith: ['someone-else'] }),
        other,
      ),
    ).toBe(false);
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
  it('substitutes arbitrary custom keys', () => {
    expect(fillPrompt('Tone: {tone}', { tone: 'bold' })).toBe('Tone: bold');
  });
  it('leaves {step:Name} untouched (its colon is not part of a {key})', () => {
    expect(fillPrompt('Use {step:Brief} and {product}', { product: 'A', step: 'X' })).toBe(
      'Use {step:Brief} and A',
    );
  });
});

describe('promptVarsForStep', () => {
  const steps = [
    { index: 0, name: 'Brief' },
    { index: 1, name: 'Insight' },
    { index: 2, name: 'Prompts' },
  ];

  it('offers {input} only after the first step', () => {
    expect(promptVarsForStep(steps, 0, {}).some((v) => v.token === '{input}')).toBe(false);
    expect(promptVarsForStep(steps, 1, {}).some((v) => v.token === '{input}')).toBe(true);
  });

  it('offers {step:Name} for earlier named steps only (not self or later)', () => {
    const tokens = promptVarsForStep(steps, 2, {}).map((v) => v.token);
    expect(tokens).toContain('{step:Brief}');
    expect(tokens).toContain('{step:Insight}');
    expect(tokens).not.toContain('{step:Prompts}');
  });

  it('offers only project vars present in the context (blank omitted)', () => {
    const tokens = promptVarsForStep(steps, 1, { product: 'Runner X', niche: '   ' }).map((v) => v.token);
    expect(tokens).toContain('{product}');
    expect(tokens).not.toContain('{niche}');
    expect(tokens).not.toContain('{homepage}');
  });

  it('lists run variables present in the map, labelled (blank values skipped)', () => {
    const out = promptVarsForStep(
      steps,
      1,
      { homepage: 'https://x.com', tone: 'bold', blank: '  ' },
      { homepage: 'Homepage', tone: 'Tone' },
    );
    const tokens = out.map((v) => v.token);
    expect(tokens).toContain('{homepage}');
    expect(tokens).toContain('{tone}');
    expect(tokens).not.toContain('{blank}');
    expect(out.find((v) => v.token === '{tone}')?.label).toBe('Tone');
    expect(out.find((v) => v.token === '{homepage}')?.label).toBe('Homepage');
  });
});

describe('unknownStepRefs', () => {
  it('flags {step:X} names matching no step (case-insensitive), de-duped', () => {
    expect(
      unknownStepRefs('Use {step:Brief} and {step:Ghost} and {step:ghost}', ['Brief', 'Insight']),
    ).toEqual(['Ghost']);
  });
  it('returns nothing when every reference resolves', () => {
    expect(unknownStepRefs('{step:Brief} {input} {product}', ['Brief'])).toEqual([]);
  });
});

describe('resolveStepRefs', () => {
  const steps = [
    { name: 'Brief', result: 'BRIEF-OUT' },
    { name: 'Insight', result: 'INSIGHT-OUT' },
    { name: 'Prompts', result: '' },
  ];

  it('{input} = the most recent earlier step with a result', () => {
    const r = resolveStepRefs('From input: {input}', steps, 2);
    expect(r.used).toBe(true);
    expect(r.prompt).toBe('From input: INSIGHT-OUT');
  });

  it('{step:Name} pulls a named earlier step (case-insensitive)', () => {
    const r = resolveStepRefs('Brief was: {step:brief}', steps, 2);
    expect(r.used).toBe(true);
    expect(r.prompt).toBe('Brief was: BRIEF-OUT');
  });

  it('used=false and prompt unchanged when no placeholder is present', () => {
    const r = resolveStepRefs('No placeholders here', steps, 2);
    expect(r.used).toBe(false);
    expect(r.prompt).toBe('No placeholders here');
  });

  it('unresolved {step:X} (no result or no match) becomes empty', () => {
    const r = resolveStepRefs('X={step:Prompts} Y={step:Ghost}', steps, 2);
    expect(r.prompt).toBe('X= Y=');
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

describe('labelColor', () => {
  const labels = [{ name: 'Bug', color: '#eb5757' }];
  it('uses the workspace label colour, matched case-insensitively', () => {
    expect(labelColor('bug', labels)).toBe('#eb5757');
  });
  it('falls back to the deterministic tagColor when unknown', () => {
    expect(labelColor('whatever', labels)).toBe(tagColor('whatever'));
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

describe('model catalog', () => {
  it('has at least one model per provider', () => {
    for (const p of Object.values(Provider)) {
      expect((MODEL_CATALOG[p] ?? []).length).toBeGreaterThan(0);
    }
  });
  it('validates models against the catalog', () => {
    expect(isModelAllowed(Provider.Anthropic, 'claude-sonnet-4-6')).toBe(true);
    expect(isModelAllowed(Provider.Anthropic, 'gpt-5.5')).toBe(false);
  });
  it('defaultModel returns the first catalog entry', () => {
    expect(defaultModel(Provider.Anthropic)).toBe('claude-opus-4-8');
    expect(isModelAllowed(Provider.OpenAI, defaultModel(Provider.OpenAI))).toBe(true);
  });
  it('looksLikeModelId distinguishes real ids from display labels', () => {
    // Real provider model ids (lowercase, hyphenated, may contain dots/digits).
    expect(looksLikeModelId('claude-opus-4-8')).toBe(true);
    expect(looksLikeModelId('gpt-5.5-pro')).toBe(true);
    expect(looksLikeModelId('deepseek-chat')).toBe(true);
    expect(looksLikeModelId('o1')).toBe(true);
    // Fixed-step display labels — not ids.
    expect(looksLikeModelId('Claude')).toBe(false);
    expect(looksLikeModelId('GPT-5.5 Pro')).toBe(false);
    expect(looksLikeModelId('DeepSeek')).toBe(false);
    expect(looksLikeModelId('')).toBe(false);
  });
});

describe('evalCondition', () => {
  const vars = { product: 'Runner X', stock: '12', empty: '', note: 'Hello World' };
  it('eq / ne are case-insensitive + trimmed', () => {
    expect(evalCondition({ variable: 'product', op: 'eq', value: 'runner x' }, vars)).toBe(true);
    expect(evalCondition({ variable: 'product', op: 'ne', value: 'runner x' }, vars)).toBe(false);
    expect(evalCondition({ variable: 'product', op: 'eq', value: 'Other' }, vars)).toBe(false);
  });
  it('contains', () => {
    expect(evalCondition({ variable: 'note', op: 'contains', value: 'world' }, vars)).toBe(true);
    expect(evalCondition({ variable: 'note', op: 'contains', value: 'bye' }, vars)).toBe(false);
    // empty operand never matches
    expect(evalCondition({ variable: 'note', op: 'contains', value: '' }, vars)).toBe(false);
  });
  it('exists / empty', () => {
    expect(evalCondition({ variable: 'product', op: 'exists' }, vars)).toBe(true);
    expect(evalCondition({ variable: 'empty', op: 'exists' }, vars)).toBe(false);
    expect(evalCondition({ variable: 'missing', op: 'exists' }, vars)).toBe(false);
    expect(evalCondition({ variable: 'empty', op: 'empty' }, vars)).toBe(true);
    expect(evalCondition({ variable: 'product', op: 'empty' }, vars)).toBe(false);
  });
  it('gt / lt parse numbers; non-numbers never pass', () => {
    expect(evalCondition({ variable: 'stock', op: 'gt', value: '5' }, vars)).toBe(true);
    expect(evalCondition({ variable: 'stock', op: 'lt', value: '5' }, vars)).toBe(false);
    expect(evalCondition({ variable: 'product', op: 'gt', value: '5' }, vars)).toBe(false);
  });
});

describe('prompt marketplace placeholders', () => {
  it('parsePromptVariables extracts unique names from ${var} and ${var:default}', () => {
    expect(parsePromptVariables('Write about ${topic} for ${audience:devs}')).toEqual([
      'topic',
      'audience',
    ]);
    expect(parsePromptVariables('${a} ${a} ${b}')).toEqual(['a', 'b']);
    expect(parsePromptVariables('no vars here')).toEqual([]);
  });
  it('toLyraPlaceholders converts ${var}/${var:default} to {var}', () => {
    expect(toLyraPlaceholders('Hi ${name:there}, about ${topic}')).toBe(
      'Hi {name}, about {topic}',
    );
    expect(toLyraPlaceholders('plain text')).toBe('plain text');
  });
});

describe('isActionStep', () => {
  it('is false for prompt steps and undefined kind (back-compat)', () => {
    expect(isActionStep({ kind: StepKind.Prompt })).toBe(false);
    expect(isActionStep({})).toBe(false); // legacy step: no kind === prompt
  });
  it('is true only for action steps', () => {
    expect(isActionStep({ kind: StepKind.Action })).toBe(true);
  });
});

describe('computeAdDiff', () => {
  it('splits today vs active into new / stopped / ongoing', () => {
    expect(computeAdDiff(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      newIds: ['a'], stoppedIds: ['d'], ongoingIds: ['b', 'c'],
    });
  });
  it('first run (no active) → everything new, nothing stopped', () => {
    expect(computeAdDiff(['a', 'b'], [])).toEqual({ newIds: ['a', 'b'], stoppedIds: [], ongoingIds: [] });
  });
  it('empty crawl → everything stopped', () => {
    expect(computeAdDiff([], ['a', 'b'])).toEqual({ newIds: [], stoppedIds: ['a', 'b'], ongoingIds: [] });
  });
  it('dedupes ids within a set', () => {
    expect(computeAdDiff(['a', 'a'], ['a'])).toEqual({ newIds: [], stoppedIds: [], ongoingIds: ['a'] });
  });
});

describe('parseImageRefs', () => {
  it('detects {input} and {step:Name} references', () => {
    expect(parseImageRefs('Edit {input} to add {step:Brief}')).toEqual({
      input: true,
      names: ['Brief'],
    });
  });
  it('returns no refs for a plain prompt', () => {
    expect(parseImageRefs('A red sneaker on marble')).toEqual({ input: false, names: [] });
  });
  it('collects multiple named refs and trims them', () => {
    expect(parseImageRefs('{step: Logo } over {step:Scene}')).toEqual({
      input: false,
      names: ['Logo', 'Scene'],
    });
  });
});

describe('video provider (Replicate-backed)', () => {
  it('catalogs real Replicate video slugs (owner/name), not the placeholder', () => {
    const ids = MODEL_CATALOG[Provider.Video].map((m) => m.id);
    expect(ids).not.toContain('video-default');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.includes('/'))).toBe(true); // owner/name form
    expect(defaultModel(Provider.Video)).toBe(ids[0]);
  });
  it('a video step is key-gated on the default (video) key slot', () => {
    expect(keyProviderFor(Provider.Video)).toBe(Provider.Video);
    expect(providerNeedsKey(Provider.Video)).toBe(true);
  });
});

describe('isNetscapeCookies', () => {
  it('accepts a file with the Netscape header', () => {
    expect(isNetscapeCookies('# Netscape HTTP Cookie File\n')).toBe(true);
    expect(isNetscapeCookies('# HTTP Cookie File\n\n')).toBe(true);
  });
  it('accepts a file with a 7-field tab-separated cookie record', () => {
    expect(isNetscapeCookies('.youtube.com\tTRUE\t/\tTRUE\t1799999999\tSID\tabc123')).toBe(true);
  });
  it('accepts #HttpOnly_-prefixed cookie records (browser extension exports)', () => {
    expect(isNetscapeCookies('#HttpOnly_.x.com\tTRUE\t/\tTRUE\t1799999999\ta\tb')).toBe(true);
    expect(isNetscapeCookies('# Netscape HTTP Cookie File\n#HttpOnly_.google.com\tTRUE\t/\tTRUE\t1799999999\tSID\txxx')).toBe(true);
  });
  it('rejects a 7-column non-cookie TSV (weak false-positive guard)', () => {
    expect(isNetscapeCookies('a\tb\tc\td\te\tf\tg')).toBe(false);
    expect(isNetscapeCookies('col1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7')).toBe(false);
  });
  it('rejects empty / garbage / JSON', () => {
    expect(isNetscapeCookies('')).toBe(false);
    expect(isNetscapeCookies('   \n\n')).toBe(false);
    expect(isNetscapeCookies('just some text\nno tabs here')).toBe(false);
    expect(isNetscapeCookies('{"cookies":[]}')).toBe(false);
  });
});

describe('fallbackChain', () => {
  const all = () => true;
  const none = () => false;
  it('text primary + all alts eligible → primary first, then Anthropic→OpenAI→DeepSeek order', () => {
    expect(fallbackChain(Provider.OpenAI, all)).toEqual([Provider.OpenAI, Provider.Anthropic, Provider.DeepSeek]);
    expect(fallbackChain(Provider.DeepSeek, all)).toEqual([Provider.DeepSeek, Provider.Anthropic, Provider.OpenAI]);
  });
  it('text primary + no alts eligible → just [primary]', () => {
    expect(fallbackChain(Provider.Anthropic, none)).toEqual([Provider.Anthropic]);
  });
  it('includes only eligible alts', () => {
    const onlyDeepSeek = (p: Provider) => p === Provider.DeepSeek;
    expect(fallbackChain(Provider.OpenAI, onlyDeepSeek)).toEqual([Provider.OpenAI, Provider.DeepSeek]);
  });
  it('non-text primary → just [primary] (no cross-modality fallback)', () => {
    expect(fallbackChain(Provider.Image, all)).toEqual([Provider.Image]);
    expect(fallbackChain(Provider.Video, all)).toEqual([Provider.Video]);
    expect(fallbackChain(Provider.Crawl, all)).toEqual([Provider.Crawl]);
  });
});

describe('Provider.Research wiring', () => {
  it('needs no AI key (resolved internally)', () => {
    expect(providerNeedsKey(Provider.Research)).toBe(false);
  });
  it('has a catalog placeholder (Record stays exhaustive)', () => {
    expect(MODEL_CATALOG[Provider.Research]?.length).toBeGreaterThan(0);
  });
});
