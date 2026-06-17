import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProjectStatus, ProjectShare } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProjectDocument = HydratedDocument<Project>;

// A project variable — fills {key} placeholders in step prompts at run time.
@Schema({ _id: false })
export class ProjectVar {
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ default: '' })
  value!: string;
}
const ProjectVarSchema = SchemaFactory.createForClass(ProjectVar);

@Schema({ timestamps: true })
export class Project extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [ProjectVarSchema], default: [] })
  variables!: ProjectVar[];

  @Prop({
    required: true,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.Draft,
  })
  status!: ProjectStatus;

  @Prop({
    required: true,
    enum: Object.values(ProjectShare),
    default: ProjectShare.All,
  })
  shared!: ProjectShare;

  // User ids (when shared = 'people'); expanded to UserRef[] in responses.
  @Prop({ type: [String], default: [] })
  sharedWith!: string[];

  // Referenced workspace-library pipeline ids.
  @Prop({ type: [String], default: [] })
  pipelines!: string[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Indexes per hosting doc §7.
ProjectSchema.index({ workspaceId: 1, status: 1 });
ProjectSchema.index({ workspaceId: 1, createdBy: 1 });
