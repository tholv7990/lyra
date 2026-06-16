import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '@lyra/shared';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Membership {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role!: Role;

  @Prop({ required: true, default: false })
  canManageKeys!: boolean;

  createdAt!: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// One membership per (workspace, user).
MembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
