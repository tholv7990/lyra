import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { Channel, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { ChannelsService } from './channels.service';
import { CreateChannelBody } from './dto/channels.dto';

// The unified channel list (Postiz pool + GoLogin). Listing is member-level; adding
// or removing a channel manages the workspace's connections (canManageKeys).
@Controller('workspaces/:id/channels')
@UseGuards(WorkspaceGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@Param('id') ws: string, @CurrentUser() u: User): Promise<Channel[]> {
    return this.channels.list(ws, u.id);
  }

  @Post()
  @RequireManageKeys()
  create(@Param('id') ws: string, @CurrentUser() u: User, @Body() body: CreateChannelBody): Promise<Channel> {
    return this.channels.create(ws, u.id, body);
  }

  @Delete(':channelId')
  @RequireManageKeys()
  @HttpCode(204)
  async remove(@Param('id') ws: string, @Param('channelId') channelId: string, @CurrentUser() u: User): Promise<void> {
    await this.channels.remove(ws, channelId, u.id);
  }
}
