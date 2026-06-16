import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ timestamps: true })
export class Membership extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role!: Role;

  @Prop({ required: true, default: false })
  canManageKeys!: boolean;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// One ACTIVE membership per (workspace, user) — partial so a soft-removed
// member can be re-added (the inactive row stays as history).
MembershipSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
