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
}

// A user submission to the platform admins. One collection, discriminated by
// type — provider requests today; bug reports (and more) reuse the same table.
export enum RequestType {
  Provider = 'provider',
  Bug = 'bug',
}

// Triage state of a UserRequest. Open → Resolved/Declined (no separate
// "reviewing" state — kept deliberately minimal).
export enum RequestStatus {
  Open = 'open',
  Resolved = 'resolved',
  Declined = 'declined',
}
