import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { ApiKeyInfo, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { KeysService } from './keys.service';
import { UpsertKeyBody } from './dto/keys.dto';
import { parseProvider } from './key.views';

// Read = any member; write/delete = Owner or canManageKeys (per-workspace).
@Controller('workspaces/:id/keys')
@UseGuards(WorkspaceGuard)
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  async list(@Param('id') workspaceId: string): Promise<ApiKeyInfo[]> {
    return this.keys.toViews(await this.keys.list(workspaceId));
  }

  @Put(':provider')
  @RequireManageKeys()
  async upsert(
    @Param('id') workspaceId: string,
    @Param('provider') providerParam: string,
    @Body() body: UpsertKeyBody,
    @CurrentUser() user: User,
  ): Promise<ApiKeyInfo> {
    const provider = parseProvider(providerParam);
    const doc = await this.keys.upsert(workspaceId, provider, body.key, user.id);
    return this.keys.toView(doc);
  }

  @Delete(':provider')
  @RequireManageKeys()
  @HttpCode(204)
  async remove(
    @Param('id') workspaceId: string,
    @Param('provider') providerParam: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.keys.removeKey(workspaceId, parseProvider(providerParam), user.id);
  }
}
