import {
  Role,
  ProjectVisibility,
  RunStatus,
  StepStatus,
  StepMode,
  StepKey,
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

export interface Project extends Audited {
  id: string;
  workspaceId: string;
  name: string;
  product: string;
  niche: string;
  homepageUrl: string;
  brandBrief?: Record<string, unknown>;
  learnings?: string[];
  visibility: ProjectVisibility;
  sharedWith: UserRef[]; // expanded; ids are sent in UpdateProjectDto
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

export interface Run extends Audited {
  id: string;
  projectId: string;
  workspaceId: string;
  status: RunStatus;
  currentStep: number;
  steps: Step[];
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
