import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Provider, type ModelOption } from '@lyra/shared';
import type { User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { parseProvider } from '../keys/key.views';
import { ModelsService } from './models.service';

@Controller()
@UseGuards(WorkspaceGuard)
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  // Effective per-provider model catalog (refreshed-or-default) for the pickers.
  @Get('workspaces/:id/models')
  effective(
    @Param('id') workspaceId: string,
  ): Promise<Record<Provider, ModelOption[]>> {
    return this.models.effective(workspaceId);
  }

  // Refresh one provider's models from its live API (using the saved key).
  @Post('workspaces/:id/keys/:provider/models')
  @RequireManageKeys()
  @RequireCreate() // a live provider call (spend) — unverified users blocked
  refresh(
    @Param('id') workspaceId: string,
    @Param('provider') providerParam: string,
    @CurrentUser() user: User,
  ): Promise<ModelOption[]> {
    return this.models.refresh(workspaceId, parseProvider(providerParam), user.id);
  }
}
