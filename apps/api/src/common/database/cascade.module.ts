import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '../../workspaces/workspace.schema';
import { Membership, MembershipSchema } from '../../workspaces/membership.schema';
import { Invite, InviteSchema } from '../../workspaces/invite.schema';
import { ApiKey, ApiKeySchema } from '../../keys/api-key.schema';
import { Project, ProjectSchema } from '../../projects/project.schema';
import { Run, RunSchema } from '../../runs/run.schema';
import { Prompt, PromptSchema } from '../../prompts/prompt.schema';
import { PromptTest, PromptTestSchema } from '../../prompt-tests/prompt-test.schema';
import { Pipeline, PipelineSchema } from '../../pipelines/pipeline.schema';
import {
  ProjectPipeline,
  ProjectPipelineSchema,
} from '../../pipelines/project-pipeline.schema';
import {
  ProviderModel,
  ProviderModelSchema,
} from '../../models/provider-model.schema';
import { CascadeService } from './cascade.service';

// Standalone: depends only on schemas (not feature modules), so importing it
// anywhere can't create a cycle.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Run.name, schema: RunSchema },
      { name: Prompt.name, schema: PromptSchema },
      { name: PromptTest.name, schema: PromptTestSchema },
      { name: Pipeline.name, schema: PipelineSchema },
      { name: ProjectPipeline.name, schema: ProjectPipelineSchema },
      { name: ProviderModel.name, schema: ProviderModelSchema },
    ]),
  ],
  providers: [CascadeService],
  exports: [CascadeService],
})
export class CascadeModule {}
