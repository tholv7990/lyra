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
 * Soft delete is built in: reads exclude `active:false` by default, and
 * `softDelete()` flips the flag instead of removing the document. Writes take an
 * optional ClientSession for transactions. Duplicate-key (11000) -> 409.
 */
export abstract class BaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  // Adds the soft-delete guard (active !== false) to a filter.
  protected active(filter: QueryFilter<T> = {}): QueryFilter<T> {
    return { ...filter, active: { $ne: false } } as QueryFilter<T>;
  }

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
    return this.model
      .findOne(this.active({ _id: id } as QueryFilter<T>), null, { session })
      .exec();
  }

  findOne(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.findOne(this.active(filter), null, { session }).exec();
  }

  find(filter: QueryFilter<T> = {}, options?: QueryOptions<T>) {
    return this.model.find(this.active(filter), null, options).exec();
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

  // Soft delete: flip active to false (and record who, if provided).
  softDelete(id: string, updatedBy?: string, session?: ClientSession) {
    const update = (
      updatedBy ? { active: false, updatedBy } : { active: false }
    ) as UpdateQuery<T>;
    return this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after', session })
      .exec();
  }

  deleteOne(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.deleteOne(filter, { session }).exec();
  }

  deleteMany(filter: QueryFilter<T>, session?: ClientSession) {
    return this.model.deleteMany(filter, { session }).exec();
  }

  count(filter: QueryFilter<T> = {}) {
    return this.model.countDocuments(this.active(filter)).exec();
  }

  async exists(filter: QueryFilter<T>): Promise<boolean> {
    return (await this.model.exists(this.active(filter))) !== null;
  }
}
