import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProjectVisibility } from '@lyra/shared';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Project {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  createdBy!: string;

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

  // Used only when visibility === 'shared'.
  @Prop({ type: [String], default: [] })
  sharedWith!: string[];

  // Soft delete: delete flips this to false rather than removing the document.
  @Prop({ required: true, default: true, index: true })
  active!: boolean;

  createdAt!: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Indexes per hosting doc §7.
ProjectSchema.index({ workspaceId: 1, visibility: 1 });
ProjectSchema.index({ workspaceId: 1, createdBy: 1 });
