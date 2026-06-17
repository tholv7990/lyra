import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type LabelDocument = HydratedDocument<Label>;

// A reusable, colour-coded label owned by a workspace. Prompts/pipelines
// reference labels by `name` (their `tags`); the colour is stored here.
// `nameKey` is the lowercased name, used for case-insensitive uniqueness.
@Schema({ timestamps: true })
export class Label extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  nameKey!: string;

  @Prop({ required: true })
  color!: string;
}

export const LabelSchema = SchemaFactory.createForClass(Label);
// One label per (workspace, name) — case-insensitive via nameKey.
LabelSchema.index(
  { workspaceId: 1, nameKey: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
