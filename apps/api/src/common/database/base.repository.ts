import { ConflictException } from '@nestjs/common';
import {
  ClientSession,
  HydratedDocument,
  Model,
  QueryFilter,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';

/**
 * Generic Mongoose repository. Feature services extend it (over the raw schema
 * class) to inherit common CRUD against their model, and add domain methods.
 *
 *   @Injectable()
 *   export class UsersService extends BaseRepository<User> {
 *     constructor(@InjectModel(User.name) model: Model<User>) {
 *       super(model);
 *     }
 *     // ...domain methods
 *   }
 *
 * Every write takes an optional ClientSession so callers can run inside a
 * transaction (see AuthService onboarding). Duplicate-key errors (11000)
 * surface as 409 ConflictException.
 *
 * Pattern adapted from the common NestJS "abstract repository" approach — see
 * Sources in the conversation.
 */
export abstract class BaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(
    doc: Partial<T>,
    session?: ClientSession,
  ): Promise<HydratedDocument<T>> {
    try {
      const created = new this.model(doc);
      return (await created.save({ session })) as HydratedDocument<T>;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('Resource already exists');
      }
      throw err;
    }
  }

  findById(id: string, session?: ClientSession) {
    return this.model.findById(id, null, { session }).exec();
  }

  findOne(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.findOne(filter, null, { session }).exec();
  }

  find(filter: QueryFilter<T> = {}, options?: QueryOptions<T>) {
    return this.model.find(filter, null, options).exec();
  }

  findByIdAndUpdate(
    id: string,
    update: UpdateQuery<T>,
    session?: ClientSession,
  ) {
    return this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after', session })
      .exec();
  }

  findOneAndUpdate(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    session?: ClientSession,
  ) {
    return this.model
      .findOneAndUpdate(filter, update, { returnDocument: 'after', session })
      .exec();
  }

  updateOne(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    session?: ClientSession,
  ) {
    return this.model.updateOne(filter, update, { session }).exec();
  }

  deleteById(id: string, session?: ClientSession) {
    return this.model.findByIdAndDelete(id, { session }).exec();
  }

  deleteOne(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.deleteOne(filter, { session }).exec();
  }

  deleteMany(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.deleteMany(filter, { session }).exec();
  }

  count(filter: QueryFilter<T> = {}) {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: QueryFilter<T>): Promise<boolean> {
    return (await this.model.exists(filter)) !== null;
  }
}
