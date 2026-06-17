import {
  Role,
  ProjectStatus,
  ProjectShare,
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
  PromptStatus,
  MediaType,
  Provider,
} from '../enums';

// A populated actor reference — what createdBy/updatedBy expand to in responses.
export interface UserRef {
  id: string;
  name: string;
}

// Standard audit envelope present on every persisted collection (transport form).
export interface Audited {
  active: boolean;
  createdBy: UserRef;
  updatedBy: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace extends Audited {
  id: string;
  name: string;
  type: 'personal' | 'team';
}

// A workspace plus the requesting user's role in it — what GET /workspaces returns.
export interface WorkspaceView extends Workspace {
  role: Role;
  canManageKeys: boolean;
}

export interface Membership extends Audited {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  canManageKeys: boolean;
}

// A member row for the workspace members list (membership joined with the user).
export interface MemberView {
  membershipId: string;
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  canManageKeys: boolean;
  createdAt: string;
}

export interface Invite extends Audited {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
}

// Safe transport shape — never carries the encryptedKey.
export interface ApiKeyInfo extends Audited {
  id: string;
  workspaceId: string;
  provider: string;
  last4: string;
}

// A named value a project carries; fills {key} placeholders in step prompts at
// run time. e.g. { key: 'product', value: 'Cozy Plush Pet Sofa' }.
export interface ProjectVariable {
  key: string;
  value: string;
}

export interface Project extends Audited {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  variables: ProjectVariable[];
  status: ProjectStatus;
  shared: ProjectShare; // who a public project reaches
  sharedWith: UserRef[]; // expanded; ids are sent in UpdateProjectDto (when shared='people')
  pipelines: string[]; // referenced pipeline ids (workspace library)
}

export interface Step {
  index: number;
  key?: StepKey; // fixed pipeline only; composable pipeline steps omit it
  name?: string; // composable pipeline step name
  promptId?: string; // composable: the library prompt this step ran
  provider?: Provider; // composable: per-step provider (else derived from key)
  mode: StepMode;
  status: StepStatus;
  model: string;
  prompt: string;
  result?: string;
  assetIds?: string[];
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Run extends Audited {
  id: string;
  projectId?: string; // absent for a builder "test run" (no project)
  workspaceId: string;
  pipelineId?: string; // set when the run came from a composable pipeline
  pipelineName?: string;
  context?: { note?: string }; // the pipeline note — the first step's default input
  // Snapshot of token→value resolved into step prompts at run time: the project's
  // variables, pipeline custom vars, and system vars ({note}/{date}). Frozen at run
  // creation so later pipeline/project edits don't leak in.
  variables?: Record<string, string>;
  status: RunStatus;
  currentStep: number;
  steps: Step[];
}

// Media attached to a prompt (sent alongside the prompt to the AI provider).
// `url` references a file stored by the api; `size` is the byte length.
export interface PromptMedia {
  type: MediaType;
  url: string;
  name?: string;
  mime?: string;
  size?: number;
}

// A reusable prompt in the workspace library.
export interface Prompt extends Audited {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  status: PromptStatus;
  media: PromptMedia[];
  tags: string[];
  // Default provider + model for testing this prompt (pre-selected in the
  // playground). Optional — older prompts have none.
  provider?: Provider;
  model?: string;
}

// A tag in the workspace vocabulary plus how many visible prompts carry it.
export interface TagCount {
  value: string;
  count: number;
}

// A prompt author in the visible prompt vocabulary plus prompt count.
export interface PromptAuthorCount {
  id: string;
  name: string;
  count: number;
}

// A provider in the visible prompt vocabulary plus how many prompts use it.
// Drives the (stable, full-library) provider filter on the Prompts page.
export interface ProviderCount {
  provider: Provider;
  count: number;
}

// A workspace label: a reusable, colour-coded tag owned by the workspace.
// Prompts/pipelines reference labels by `name` (their `tags`); the colour is
// resolved from the workspace's labels (see labelColor()).
export interface LabelInfo {
  id: string;
  name: string;
  color: string;
}

// A page of results from a paginated list endpoint.
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ===== Chats (conversations) =====
// A chat is a Claude-style multi-turn conversation in the workspace. Every turn
// is a prompt→answer exchange stamped with the provider·model that produced it.
// Chats are the iteration workshop; good prompts get promoted to the library.
export type ChatRole = 'user' | 'assistant';

export interface ConversationMessage {
  id: string;
  role: ChatRole;
  content: string;
  media?: PromptMedia[];
  provider: Provider;
  model: string;
  usage?: { tokens?: number; costUsd?: number };
  error?: string;
  createdAt: string;
}

// The full conversation with its message thread (the detail view).
export interface Conversation extends Audited {
  id: string;
  workspaceId: string;
  title: string;
  provider: Provider;
  model: string;
  originPromptId?: string; // the library prompt this chat was opened from
  starred: boolean;
  messages: ConversationMessage[];
}

// A lightweight list item for the chat-history sidebar (no message bodies).
export interface ConversationSummary {
  id: string;
  title: string;
  provider: Provider;
  model: string;
  starred: boolean;
  messageCount: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Composable pipelines =====
// One node in a pipeline: a library prompt run on a chosen provider·model, in
// auto or gate (pause-for-approval) mode. Steps are inline in the pipeline.
export interface PipelineStep {
  id: string;
  name: string;
  promptId: string;
  provider: Provider;
  model: string;
  mode: StepMode;
}

// A user-defined variable for a pipeline. Any step prompt can reference it as
// {key}; its value is entered when a run starts (prefilled from `default`), then
// resolved into the prompts at run time alongside project + system vars.
export interface PipelineVariable {
  key: string; // token name, e.g. "tone" → referenced as {tone}
  label?: string; // human label for the run-start form / composer chip
  default?: string; // prefilled value
}

// A reusable workspace-library pipeline: an ordered, linear chain of steps.
// Assigned to projects (many-to-many) and run in a project's context.
export interface Pipeline extends Audited {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  tags: string[];
  steps: PipelineStep[];
  variables: PipelineVariable[];
}

export interface Asset {
  id: string;
  runId: string;
  workspaceId: string;
  stepIndex: number;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbUrl?: string;
  meta?: Record<string, unknown>;
  approved?: boolean;
}
