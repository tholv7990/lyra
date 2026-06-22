export enum Role {
  Owner = 'owner',
  Member = 'member',
  Viewer = 'viewer', // read-only: can view workspace content but not create/edit/run
}

// A project is a draft (private to its creator + workspace owners) until it's
// published; a public project's reach is set by `ProjectShare`.
export enum ProjectStatus {
  Draft = 'draft',
  Public = 'public',
}

// Who a published (public) project reaches: everyone in the workspace, or a
// chosen set of members (`sharedWith`).
export enum ProjectShare {
  All = 'all',
  People = 'people',
}

export enum RunStatus {
  Idle = 'idle',
  Running = 'running',
  AwaitingGate = 'awaiting_gate',
  Done = 'done',
  Error = 'error',
}

export enum StepStatus {
  Idle = 'idle',
  Queued = 'queued',
  Running = 'running',
  Waiting = 'waiting',
  Skipped = 'skipped', // guard condition not met — step bypassed, run continued
  Done = 'done',
  Error = 'error',
}

export enum StepMode {
  Auto = 'auto',
  Gate = 'gate',
}

export enum StepKey {
  Find = 'find',
  Crawl = 'crawl',
  Brief = 'brief',
  Insight = 'insight',
  Prompts = 'prompts',
  Images = 'images',
  Video = 'video',
  QA = 'qa',
}

export enum Provider {
  OpenAI = 'openai',
  DeepSeek = 'deepseek',
  Anthropic = 'anthropic',
  Image = 'image',
  Video = 'video',
  Crawl = 'crawl', // Source step: fetch a URL → product images + text (no API key)
}

export enum PromptStatus {
  Draft = 'draft',
  Public = 'public',
}

export enum MediaType {
  Image = 'image',
  Audio = 'audio',
  Video = 'video',
  File = 'file',
}

// The kind of output a library prompt is for. Metadata only (badge + filter) —
// it does not change how the prompt runs.
export enum PromptType {
  Text = 'text',
  Image = 'image',
  Audio = 'audio',
  Video = 'video',
  File = 'file',
}

export enum StepKind { Prompt = 'prompt', Action = 'action' }
export enum ActionType { Brand = 'brand', Crawl = 'crawl', Publish = 'publish' }
export enum Corner { TL = 'tl', TR = 'tr', BL = 'bl', BR = 'br', Center = 'center' }

// Workspace kind: Personal workspaces are created automatically on sign-up;
// team workspaces are upgraded via an admin-approved TeamUpgrade request.
export enum WorkspaceType {
  Personal = 'personal',
  Team = 'team',
}

// A user submission to the platform admins. One collection, discriminated by
// type — provider requests today; bug reports + team-upgrade requests reuse the same table.
export enum RequestType {
  Provider = 'provider',
  Bug = 'bug',
  TeamUpgrade = 'team-upgrade',
}

// Triage state of a UserRequest. Open → Resolved/Declined (no separate
// "reviewing" state — kept deliberately minimal).
export enum RequestStatus {
  Open = 'open',
  Resolved = 'resolved',
  Declined = 'declined',
}

// Manual status of a Task on the project board (kanban columns). Not coupled to
// runs — a human moves the task; 'complete' means the work was judged done.
export enum TaskStatus {
  New = 'new',
  InProgress = 'in_progress',
  OnHold = 'on_hold',
  Complete = 'complete',
}

// Manual priority of a Task (Linear-style). 'none' is the default (no priority).
export enum TaskPriority {
  None = 'none',
  Urgent = 'urgent',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// How a Channel publishes — the "connection type". `postiz` posts through the
// Postiz pool (its accounts auto-appear as channels); `gologin` drives a logged-in
// GoLogin browser profile via the browser connector (needs a profileId).
export enum ChannelType {
  Postiz = 'postiz',
  GoLogin = 'gologin',
}
