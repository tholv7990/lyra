import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type WorkspaceDocument = HydratedDocument<Workspace>;

@Schema({ timestamps: true })
export class Workspace extends AuditedEntity {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: ['personal', 'team'] })
  type!: 'personal' | 'team';
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
