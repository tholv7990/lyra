import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
  AdminUserUsage,
  Paged,
  Role,
} from '@lyra/shared';
import { User, UserDocument } from '../users/user.schema';
import { Membership } from '../workspaces/membership.schema';
import { Workspace } from '../workspaces/workspace.schema';
import { Project } from '../projects/project.schema';
import { Pipeline } from '../pipelines/pipeline.schema';
import { Prompt } from '../prompts/prompt.schema';
import { Run } from '../runs/run.schema';
import { Conversation } from '../conversations/conversation.schema';
import { iso } from '../common/dates';
import { AdminService } from './admin.service';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const RECENT_SIGNUPS = 8;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Escapes a free-text query so it's used literally inside a $regex.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the Mongo filter for the admin Users list. `q` matches email OR name
 * case-insensitively (a single $or of anchored-free $regex). Exported so the
 * filter shape is unit-testable without a live model.
 */
export function buildUserListFilter(q?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const term = (q ?? '').trim();
  if (term) {
    const rx = { $regex: escapeRegex(term), $options: 'i' };
    filter.$or = [{ email: rx }, { name: rx }];
  }
  return filter;
}

/**
 * Read-only platform analytics + user administration for the super-admin panel.
 * Aggregates across collections it does NOT own; every model here is injected
 * read-only and mapped to the shared safe shapes (never leaks passwordHash etc).
 * All logic lives here — the controller is a thin pass-through behind AdminGuard.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @InjectModel(Project.name) private readonly projects: Model<Project>,
    @InjectModel(Pipeline.name) private readonly pipelines: Model<Pipeline>,
    @InjectModel(Prompt.name) private readonly prompts: Model<Prompt>,
    @InjectModel(Run.name) private readonly runs: Model<Run>,
    @InjectModel(Conversation.name)
    private readonly conversations: Model<Conversation>,
    private readonly admin: AdminService,
  ) {}

  // Platform-wide counts + the most recent signups for the dashboard.
  async getOverview(): Promise<AdminOverview> {
    const [users, workspaces, projects, pipelines, prompts, runs, chats] =
      await Promise.all([
        this.users.countDocuments().exec(),
        this.workspaces.countDocuments().exec(),
        this.projects.countDocuments().exec(),
        this.pipelines.countDocuments().exec(),
        this.prompts.countDocuments().exec(),
        this.runs.countDocuments().exec(),
        this.conversations.countDocuments().exec(),
      ]);

    const since = new Date(Date.now() - THIRTY_DAYS_MS);
    const signups30d = await this.users
      .countDocuments({ createdAt: { $gte: since } })
      .exec();

    const recent = await this.users
      .find()
      .sort({ createdAt: -1 })
      .limit(RECENT_SIGNUPS)
      .exec();
    const recentSignups = await this.toSummaries(recent);

    return {
      users,
      workspaces,
      projects,
      pipelines,
      prompts,
      runs,
      chats,
      signups30d,
      recentSignups,
    };
  }

  // A page of users; q matches email/name (case-insensitive), newest first.
  async listUsers(opts: {
    page?: number;
    limit?: number;
    q?: string;
  }): Promise<Paged<AdminUserSummary>> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
    const filter = buildUserListFilter(opts.q);

    const total = await this.users.countDocuments(filter).exec();
    const docs = await this.users
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      items: await this.toSummaries(docs),
      total,
      page,
      limit,
    };
  }

  // Full admin view of one user: workspaces (membership + workspace name) + the
  // count of items they created across collections.
  async getUserDetail(id: string): Promise<AdminUserDetail> {
    const doc = await this.users.findById(id).exec();
    if (!doc) throw new NotFoundException('User not found');

    const summary = await this.toSummary(doc);
    const [workspaces, usage] = await Promise.all([
      this.userWorkspaces(id),
      this.userUsage(id),
    ]);

    return {
      ...summary,
      updatedAt: iso(doc.updatedAt ?? doc.createdAt),
      workspaces,
      usage,
    };
  }

  // Deactivate / reactivate a user. Self-deactivation is forbidden so an admin
  // can't lock themselves out.
  async setUserActive(
    id: string,
    active: boolean,
    requestingAdminId: string,
  ): Promise<AdminUserSummary> {
    if (id === requestingAdminId && active === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    const doc = await this.users
      .findByIdAndUpdate(id, { active }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('User not found');
    return this.toSummary(doc);
  }

  // ---- helpers -----------------------------------------------------------

  // The user's memberships joined to their workspace name.
  private async userWorkspaces(
    userId: string,
  ): Promise<{ id: string; name: string; role: Role }[]> {
    const memberships = await this.memberships
      .find({ userId, active: true })
      .exec();
    if (memberships.length === 0) return [];

    const wsIds = memberships.map((m) => m.workspaceId);
    const wsDocs = await this.workspaces.find({ _id: { $in: wsIds } }).exec();
    const nameById = new Map(
      wsDocs.map((w) => [(w as { _id: unknown })._id?.toString(), w.name]),
    );

    return memberships.map((m) => ({
      id: m.workspaceId,
      name: nameById.get(m.workspaceId) ?? '(deleted workspace)',
      role: m.role,
    }));
  }

  // Items created by the user. createdBy is stored as a String (the user id),
  // so each count is a direct equality match — no ObjectId casting.
  private async userUsage(userId: string): Promise<AdminUserUsage> {
    const [projects, pipelines, prompts, runs, chats] = await Promise.all([
      this.projects.countDocuments({ createdBy: userId }).exec(),
      this.pipelines.countDocuments({ createdBy: userId }).exec(),
      this.prompts.countDocuments({ createdBy: userId }).exec(),
      this.runs.countDocuments({ createdBy: userId }).exec(),
      this.conversations.countDocuments({ createdBy: userId }).exec(),
    ]);
    return { projects, pipelines, prompts, runs, chats };
  }

  // Maps a page of user docs to summaries, resolving workspaceCount for the
  // whole page in ONE Membership aggregation (grouped by userId) — no N+1.
  private async toSummaries(
    docs: UserDocument[],
  ): Promise<AdminUserSummary[]> {
    if (docs.length === 0) return [];
    const ids = docs.map((d) => d._id.toString());
    const counts = await this.membershipCounts(ids);
    return docs.map((d) =>
      this.mapSummary(d, counts.get(d._id.toString()) ?? 0),
    );
  }

  // Single-doc summary (its own membership count).
  private async toSummary(doc: UserDocument): Promise<AdminUserSummary> {
    const count = await this.memberships
      .countDocuments({ userId: doc._id.toString(), active: true })
      .exec();
    return this.mapSummary(doc, count);
  }

  // One aggregation: active-membership count per userId for the given ids.
  private async membershipCounts(
    userIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.memberships
      .aggregate<{ _id: string; count: number }>([
        { $match: { userId: { $in: userIds }, active: true } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((r) => [r._id, r.count]));
  }

  // Builds the shared safe summary. isAdmin is derived from the email allowlist
  // (the single source of truth) — never read from a stored field.
  private mapSummary(
    doc: UserDocument,
    workspaceCount: number,
  ): AdminUserSummary {
    return {
      id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      active: doc.active ?? true,
      isAdmin: this.admin.isSuperAdmin(doc.email),
      workspaceCount,
      createdAt: iso(doc.createdAt),
    };
  }
}
