import { ProjectStatus, Provider, Role, type PromptStatus } from '@lyra/shared';

// Shared display maps that were redefined per-page. Provider display names and
// the Draft/Public status hue belong in one place so every surface matches.

export const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.OpenAI]: 'OpenAI',
  [Provider.Anthropic]: 'Anthropic',
  [Provider.DeepSeek]: 'DeepSeek',
  [Provider.Google]: 'Google',
  [Provider.Image]: 'Image',
  [Provider.Video]: 'Video',
  [Provider.Crawl]: 'Crawl',
};

// Display names for workspace roles. One place so the bell, the future Members
// page, and the role picker all read identically (like PROVIDER_LABELS).
export const ROLE_LABELS: Record<Role, string> = {
  [Role.Owner]: 'Owner',
  [Role.Member]: 'Member',
  [Role.Viewer]: 'Viewer',
};

// PromptStatus and ProjectStatus share the same 'draft'/'public' values, so one
// map serves both (keyed via ProjectStatus members).
export const STATUS_COLOR: Record<PromptStatus | ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'var(--warning)',
  [ProjectStatus.Public]: 'var(--success)',
};

// i18n key for the Draft/Public label — one map for both PromptStatus and
// ProjectStatus (same label text), replacing the per-page STATUS_KEY copies.
export const STATUS_LABEL_KEY: Record<PromptStatus | ProjectStatus, string> = {
  [ProjectStatus.Draft]: 'common.statusDraft',
  [ProjectStatus.Public]: 'common.statusPublic',
};

// i18n key for a run/step status — one map for the run views (PipelineBuilder run
// badge, TaskDetail step labels). awaiting_gate shares the 'waiting' label.
export const RUN_STATUS_LABEL_KEY: Record<string, string> = {
  idle: 'run.status_idle',
  queued: 'run.status_queued',
  running: 'run.status_running',
  waiting: 'run.status_waiting',
  awaiting_gate: 'run.status_waiting',
  skipped: 'run.status_skipped',
  done: 'run.status_done',
  error: 'run.status_error',
};
