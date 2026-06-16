import { Prop } from '@nestjs/mongoose';

// Standard audit envelope mixed into entity schemas via class inheritance.
// createdBy/updatedBy hold the acting user's id (a ref to the users collection);
// createdAt/updatedAt come from Mongoose `timestamps: true`. `active` powers
// soft delete (BaseRepository excludes active:false from reads).
export abstract class AuditedEntity {
  @Prop({ required: true, default: true, index: true })
  active!: boolean;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}
