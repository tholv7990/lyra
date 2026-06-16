import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '@lyra/shared';
import { Membership } from './membership.schema';
import { BaseRepository } from '../common/database/base.repository';

@Injectable()
export class MembershipsService extends BaseRepository<Membership> {
  constructor(@InjectModel(Membership.name) model: Model<Membership>) {
    super(model);
  }

  findFor(workspaceId: string, userId: string) {
    return this.findOne({ workspaceId, userId });
  }

  listForWorkspace(workspaceId: string) {
    return this.find({ workspaceId }, { sort: { createdAt: 1 } });
  }

  listForUser(userId: string) {
    return this.find({ userId }, { sort: { createdAt: 1 } });
  }

  updateMembership(
    workspaceId: string,
    userId: string,
    patch: { role?: Role; canManageKeys?: boolean },
    updatedBy: string,
  ) {
    return this.findOneAndUpdate({ workspaceId, userId }, { ...patch, updatedBy });
  }

  // Soft remove (active:false) so the member can be re-added later.
  removeFor(workspaceId: string, userId: string, updatedBy: string) {
    return this.findOneAndUpdate(
      { workspaceId, userId, active: { $ne: false } },
      { active: false, updatedBy },
    );
  }

  countOwners(workspaceId: string) {
    return this.count({ workspaceId, role: Role.Owner });
  }
}
