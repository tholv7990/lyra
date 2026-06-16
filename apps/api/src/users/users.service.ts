import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { BaseRepository } from '../common/database/base.repository';
import type { User as SafeUser, UserRef } from '@lyra/shared';

@Injectable()
export class UsersService extends BaseRepository<User> {
  constructor(@InjectModel(User.name) model: Model<User>) {
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

  /** Maps a Mongoose document to the safe transport shape (no passwordHash). */
  toSafeUser(doc: UserDocument): SafeUser {
    return {
      id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      active: doc.active,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
