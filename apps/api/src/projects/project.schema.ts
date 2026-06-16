import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProjectVisibility } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true })
export class Project extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  product!: string;

  @Prop({ default: '' })
  niche!: string;

  @Prop({ default: '' })
  homepageUrl!: string;

  @Prop({ type: Object })
  brandBrief?: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  learnings!: string[];

  @Prop({
    required: true,
    enum: Object.values(ProjectVisibility),
    default: ProjectVisibility.Private,
  })
  visibility!: ProjectVisibility;

  // User ids; expanded to UserRef[] in responses.
  @Prop({ type: [String], default: [] })
  sharedWith!: string[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Indexes per hosting doc §7.
ProjectSchema.index({ workspaceId: 1, visibility: 1 });
ProjectSchema.index({ workspaceId: 1, createdBy: 1 });
