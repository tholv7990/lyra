import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceType } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type WorkspaceDocument = HydratedDocument<Workspace>;

@Schema({ timestamps: true })
export class Workspace extends AuditedEntity {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: Object.values(WorkspaceType) })
  type!: WorkspaceType;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
