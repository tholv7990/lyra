export enum Role {
  Owner = 'owner',
  Member = 'member',
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
