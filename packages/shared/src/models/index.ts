import {
  Role,
  ProjectVisibility,
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
} from '../enums';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  createdBy: string;
  createdAt: string;
}

// A workspace plus the requesting user's role in it — what GET /workspaces returns.
export interface WorkspaceView extends Workspace {
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

export interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  canManageKeys: boolean;
  createdAt: string;
}

export interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

// Safe transport shape — never carries the encryptedKey.
export interface ApiKeyInfo {
  id: string;
  workspaceId: string;
  provider: string;
  last4: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  createdBy: string;
  name: string;
  product: string;
  niche: string;
  homepageUrl: string;
  brandBrief?: Record<string, unknown>;
  learnings?: string[];
  visibility: ProjectVisibility;
  sharedWith: string[]; // used only when visibility === 'shared'
  createdAt: string;
}

export interface Step {
  index: number;
  key: StepKey;
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

export interface Run {
  id: string;
  projectId: string;
  workspaceId: string;
  createdBy: string;
  status: RunStatus;
  currentStep: number;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
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
