import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import type { WorkspaceView } from '@lyra/shared';
import { Workspace } from './workspace.schema';
import { MembershipsService } from './memberships.service';
import { BaseRepository } from '../common/database/base.repository';
import { toWorkspaceView } from './views';

@Injectable()
export class WorkspacesService extends BaseRepository<Workspace> {
  constructor(
    @InjectModel(Workspace.name) model: Model<Workspace>,
    private readonly memberships: MembershipsService,
  ) {
    super(model);
  }

  createPersonal(userId: string, name: string, session?: ClientSession) {
    return this.create(
      { name, type: 'personal', createdBy: userId },
      session,
    );
  }

  rename(id: string, name: string) {
    return this.findByIdAndUpdate(id, { name });
  }

  // The caller's workspaces, each annotated with their role/canManageKeys.
  async listForUser(userId: string): Promise<WorkspaceView[]> {
    const memberships = await this.memberships.listForUser(userId);
    if (memberships.length === 0) return [];
    const workspaces = await this.find({
      _id: { $in: memberships.map((m) => m.workspaceId) },
    });
    const byId = new Map(workspaces.map((w) => [w._id.toString(), w]));
    return memberships
      .map((m) => {
        const w = byId.get(m.workspaceId);
        return w ? toWorkspaceView(w, m.role, m.canManageKeys) : null;
      })
      .filter((v): v is WorkspaceView => v !== null);
  }
}
