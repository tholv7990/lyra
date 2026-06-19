import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { BaseRepository } from '../common/database/base.repository';
import { AdminService } from '../admin/admin.service';
import { iso } from '../common/dates';
import type { User as SafeUser, UserRef } from '@lyra/shared';

@Injectable()
export class UsersService extends BaseRepository<User> {
  constructor(
    @InjectModel(User.name) model: Model<User>,
    private readonly admin: AdminService,
  ) {
    super(model);
  }

  findByEmail(email: string) {
    return this.findOne({ email: email.toLowerCase() });
  }

  findByIds(ids: string[]) {
    return this.find({ _id: { $in: ids } });
  }

  /** Batch-resolve user ids to populated { id, name } refs for responses. */
  async refMap(ids: (string | undefined)[]): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (unique.length === 0) return new Map();
    const users = await this.findByIds(unique);
    return new Map(
      users.map((u) => [u._id.toString(), { id: u._id.toString(), name: u.name }]),
    );
  }

  /**
   * Maps a Mongoose document to the safe transport shape (no passwordHash).
   * `isAdmin` is the single point where admin status is stamped onto the user
   * the client receives — always computed server-side from the email allowlist,
   * never read from request input or persisted. Every auth path (login/signup/
   * me/change-password) builds its user here, so all of them carry isAdmin.
   */
  toSafeUser(doc: UserDocument): SafeUser {
    return {
      id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      active: doc.active ?? true,
      isAdmin: this.admin.isSuperAdmin(doc.email),
      createdAt: iso(doc.createdAt),
      updatedAt: iso(doc.updatedAt ?? doc.createdAt),
    };
  }
}
