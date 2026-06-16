import { Role, ProjectVisibility, StepKey, PromptStatus, Provider, StepMode } from '../enums';
import type { PromptMedia } from '../models';

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

export interface CreateProjectDto {
  name: string;
  product: string;
  niche: string;
  homepageUrl: string;
}

export interface UpdateProjectDto {
  name?: string;
  product?: string;
  niche?: string;
  homepageUrl?: string;
  brandBrief?: Record<string, unknown>;
  visibility?: ProjectVisibility;
  sharedWith?: string[];
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
  type: StepKey;
  status?: PromptStatus;
  media?: PromptMedia[];
  tags?: string[];
}

export interface UpdatePromptDto {
  title?: string;
  content?: string;
  type?: StepKey;
  status?: PromptStatus;
  media?: PromptMedia[];
  tags?: string[];
}

// ===== Pipelines =====
export interface PipelineStepInput {
  id?: string;
  name: string;
  promptId: string;
  provider: Provider;
  model: string;
  mode: StepMode;
}

export interface CreatePipelineDto {
  name: string;
  description?: string;
  tags?: string[];
  steps?: PipelineStepInput[];
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string;
  tags?: string[];
  steps?: PipelineStepInput[];
}

// ===== Prompt testing =====
export interface CreatePromptTestDto {
  provider: Provider;
  model: string;
  input: string;
}

export interface UpdatePromptTestDto {
  starred?: boolean;
  tags?: string[];
}
