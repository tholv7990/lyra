import { Role, ProjectVisibility, StepKey, PromptStatus } from '../enums';
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
}

export interface UpdatePromptDto {
  title?: string;
  content?: string;
  type?: StepKey;
  status?: PromptStatus;
  media?: PromptMedia[];
}
