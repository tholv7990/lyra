import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { BaseRepository } from '../common/database/base.repository';
import type { User as SafeUser } from '@lyra/shared';

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

  /** Maps a Mongoose document to the safe transport shape (no passwordHash). */
  toSafeUser(doc: UserDocument): SafeUser {
    return {
      id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
