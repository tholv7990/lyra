import { Role, ProjectStatus, ProjectShare, PromptStatus, Provider, StepMode } from '../enums';
import type { FanOutConfig, PipelineOrigin, PromptMedia, StepCondition } from '../models';

// DTO *interfaces* only — no validation library lives in shared.
// The api implements each as a class-validator class that `implements`
// the interface, so the validated request shape can never drift from here.

export interface SignupDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

// ===== Account security =====
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ProjectVariableInput {
  key: string;
  value: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  variables?: ProjectVariableInput[];
  status?: ProjectStatus;
  shared?: ProjectShare;
  sharedWith?: string[];
  pipelines?: string[];
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  variables?: ProjectVariableInput[];
  status?: ProjectStatus;
  shared?: ProjectShare;
  sharedWith?: string[];
  pipelines?: string[];
}

export interface CreateWorkspaceDto {
  name: string;
}

export interface UpdateWorkspaceDto {
  name: string;
}

export interface InviteDto {
  email: string;
  role: Role;
}

export interface AcceptInviteDto {
  token: string;
}

export interface UpdateMemberDto {
  role?: Role;
  canManageKeys?: boolean;
}

// Editing a run step's prompt text (workbench).
export interface UpdateStepPromptDto {
  prompt: string;
}

export interface UpsertKeyDto {
  key: string;
}

// ===== Prompt library =====
export interface CreatePromptDto {
  title: string;
  content: string;
  status?: PromptStatus;
  media?: PromptMedia[];
  tags?: string[];
  provider?: Provider;
  model?: string;
}

export interface UpdatePromptDto {
  title?: string;
  content?: string;
  status?: PromptStatus;
  media?: PromptMedia[];
  tags?: string[];
  provider?: Provider;
  model?: string;
}

// ===== Pipelines =====
export interface PipelineStepInput {
  id?: string;
  name: string;
  promptId: string;
  provider: Provider;
  model: string;
  mode: StepMode;
  fanOut?: FanOutConfig;
  condition?: StepCondition;
}

export interface PipelineVariableInput {
  key: string;
  label?: string;
  default?: string;
}

export interface CreatePipelineDto {
  name: string;
  description?: string;
  tags?: string[];
  steps?: PipelineStepInput[];
  variables?: PipelineVariableInput[];
  origin?: PipelineOrigin;
}

// ===== AI pipeline generation =====
// The goal a user types; the server reads their prompt library and returns a
// draft (never persisted) for the builder to pre-fill. When `current` is given,
// the AI revises that existing pipeline to satisfy the instruction instead of
// designing from scratch ("Edit with AI" in the builder).
export interface GeneratePipelineDto {
  goal: string;
  current?: PipelineStepInput[];
}

// A proposed step. An empty/absent `promptId` is a GAP — no library prompt fit;
// `suggestion` describes the prompt the user should supply.
export interface GeneratedStep {
  name: string;
  promptId?: string;
  provider: Provider;
  model: string;
  mode: StepMode;
  suggestion?: string;
}

export interface GeneratedPipeline {
  name: string;
  description: string;
  steps: GeneratedStep[];
  origin: PipelineOrigin;
}

// ===== Conversational AI builder (Phase 2) =====
// A multi-turn chat that designs/refines a pipeline. Each turn the AI replies in
// words and, when it has enough, attaches a draft. `current` carries the latest
// proposed/edited steps so the AI sees the pipeline's current state.
export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatDto {
  messages: AiChatTurn[];
  current?: PipelineStepInput[];
}

export interface AiChatResponse {
  reply: string;
  draft?: GeneratedPipeline;
}

// ===== Lyra Copilot (Phase 3a — read-only tools) =====
// A chat where Claude uses read tools over the workspace (prompts, pipelines,
// projects, runs) to ground its answers. Ephemeral — not persisted like Chats.
export interface CopilotChatDto {
  messages: AiChatTurn[];
}

// An action the copilot wants to take that needs the user's approval before it
// runs (Phase 3b). The model only *proposes*; the client executes on approval.
export interface PendingCopilotAction {
  type: 'run_pipeline';
  pipelineId: string;
  pipelineName: string;
  projectId: string;
  projectName: string;
}

export interface CopilotResponse {
  reply: string;
  tools?: string[]; // names of the tools the copilot used this turn (for the UI)
  actions?: PendingCopilotAction[]; // approval-gated proposals
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string;
  tags?: string[];
  steps?: PipelineStepInput[];
  variables?: PipelineVariableInput[];
}

// Values entered when starting a pipeline run (keyed by the pipeline's variable
// keys). Unknown keys are ignored; missing keys fall back to the variable default.
export interface RunPipelineDto {
  variables?: Record<string, string>;
  // Named lists a fan-out step maps over (e.g. the source images to brand).
  collections?: Record<string, string[]>;
}

// ===== Workspace labels =====
export interface CreateLabelDto {
  name: string;
  color: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
}

// ===== Chats (conversations) =====
// Create an (empty) conversation. The first message is sent separately via the
// streaming messages endpoint. `originPromptId` links a chat opened from a
// library prompt.
export interface CreateConversationDto {
  provider: Provider;
  model: string;
  title?: string;
  originPromptId?: string;
}

// Send a user turn; the server streams the assistant reply and persists both.
export interface SendChatMessageDto {
  provider: Provider;
  model: string;
  content: string;
  media?: PromptMedia[];
}

export interface UpdateConversationDto {
  title?: string;
  starred?: boolean;
}
