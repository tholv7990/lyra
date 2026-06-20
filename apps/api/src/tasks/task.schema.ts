import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TaskStatus } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type TaskDocument = HydratedDocument<Task>;

// A unit of work inside a project. Holds the pipelines that produce its output;
// carries a manual status + a single optional assignee. Runs scope to (taskId, pipelineId).
@Schema({ timestamps: true })
export class Task extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({
    required: true,
    enum: Object.values(TaskStatus),
    default: TaskStatus.New,
    index: true,
  })
  status!: TaskStatus;

  @Prop()
  assigneeId?: string;

  @Prop({ type: [String], default: [] })
  pipelines!: string[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ projectId: 1, createdAt: -1 });
