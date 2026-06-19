import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { AdminGuard } from './admin.guard';

// Global marketplace catalog administration. Guarded by the global JwtAuthGuard
// (authenticates) + AdminGuard (super-admin allowlist). Global catalog mutation
// is reachable ONLY here — the workspace-scoped sync was removed.
@Controller('admin/marketplace')
@UseGuards(AdminGuard)
export class AdminMarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // Catalog size + freshness for the admin dashboard.
  @Get('stats')
  stats(): Promise<{ count: number; lastSyncedAt: string | null }> {
    return this.marketplace.stats();
  }

  // Refresh the global catalog from prompts.csv. Reuses the importer.
  @Post('sync')
  @HttpCode(200)
  sync(): Promise<{ imported: number }> {
    return this.marketplace.sync();
  }
}
