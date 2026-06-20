import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { WorkspaceType } from '@lyra/shared';
import type { WorkspaceView } from '@lyra/shared';
import { Workspace } from './workspace.schema';
import type { WorkspaceDocument } from './workspace.schema';
import { MembershipsService } from './memberships.service';
import { UsersService } from '../users/users.service';
import { BaseRepository } from '../common/database/base.repository';
import { toWorkspaceView } from './views';

@Injectable()
export class WorkspacesService extends BaseRepository<Workspace> {
  constructor(
    @InjectModel(Workspace.name) model: Model<Workspace>,
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  createPersonal(userId: string, name: string, session?: ClientSession) {
    return this.create(
      { name, type: WorkspaceType.Personal, createdBy: userId, updatedBy: userId },
      session,
    );
  }

  // One-way upgrade: personal → team. Returns the updated doc, or null if
  // the workspace doesn't exist or is already a team workspace.
  upgradeToTeam(id: string, actorId: string): Promise<WorkspaceDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, type: WorkspaceType.Personal },
        { $set: { type: WorkspaceType.Team, updatedBy: actorId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  rename(id: string, name: string, updatedBy: string) {
    return this.findByIdAndUpdate(id, { name, updatedBy });
  }

  async toView(
    w: WorkspaceDocument,
    role: WorkspaceView['role'],
    canManageKeys: boolean,
  ): Promise<WorkspaceView> {
    const refs = await this.users.refMap([w.createdBy, w.updatedBy]);
    return toWorkspaceView(w, role, canManageKeys, refs);
  }

  // The caller's workspaces, each annotated with their role/canManageKeys.
  async listForUser(userId: string): Promise<WorkspaceView[]> {
    const memberships = await this.memberships.listForUser(userId);
    if (memberships.length === 0) return [];
    const workspaces = await this.find({
      _id: { $in: memberships.map((m) => m.workspaceId) },
    });
    const byId = new Map(workspaces.map((w) => [w._id.toString(), w]));
    const refs = await this.users.refMap(
      workspaces.flatMap((w) => [w.createdBy, w.updatedBy]),
    );
    return memberships
      .map((m) => {
        const w = byId.get(m.workspaceId);
        return w ? toWorkspaceView(w, m.role, m.canManageKeys, refs) : null;
      })
      .filter((v): v is WorkspaceView => v !== null);
  }
}
