import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProjectPipelineDocument = HydratedDocument<ProjectPipeline>;

// Many-to-many link between a project and a library pipeline. Assigning a
// pipeline to a project pins it (links the shared definition, not a copy).
@Schema({ timestamps: true })
export class ProjectPipeline extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true })
  pipelineId!: string;
}

export const ProjectPipelineSchema = SchemaFactory.createForClass(ProjectPipeline);
// One active link per (project, pipeline) — partial so re-assigning after an
// unassign works.
ProjectPipelineSchema.index(
  { projectId: 1, pipelineId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
