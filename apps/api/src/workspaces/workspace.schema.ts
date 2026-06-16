import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WorkspaceDocument = HydratedDocument<Workspace>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Workspace {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: ['personal', 'team'] })
  type!: 'personal' | 'team';

  @Prop({ required: true })
  createdBy!: string; // userId

  createdAt!: Date;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
