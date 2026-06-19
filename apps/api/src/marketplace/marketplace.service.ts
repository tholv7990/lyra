import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePromptVariables,
  PromptStatus,
  toLyraPlaceholders,
  type MarketplacePrompt as MarketplacePromptModel,
  type Paged,
  type Prompt as PromptModel,
} from '@lyra/shared';
import { MarketplacePrompt } from './marketplace.schema';
import { toMarketplacePrompt } from './marketplace.views';
import { MarketplaceFetcher } from './marketplace.fetcher';
import { PromptsService } from '../prompts/prompts.service';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MarketplaceListOptions {
  q?: string;
  forDevs?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(MarketplacePrompt.name)
    private readonly model: Model<MarketplacePrompt>,
    private readonly fetcher: MarketplaceFetcher,
    private readonly prompts: PromptsService,
  ) {}

  // Fetch prompts.csv and upsert the global catalog, deduped by title.
  // Returns the number of catalog items written (created or updated).
  async sync(): Promise<{ imported: number }> {
    const rows = await this.fetcher.fetchRows();
    let imported = 0;
    for (const row of rows) {
      const title = row.act.trim();
      const content = row.prompt;
      if (!title || !content.trim()) continue;
      await this.model
        .updateOne(
          { title },
          {
            $set: {
              content,
              type: row.type.toUpperCase() === 'STRUCTURED' ? 'structured' : 'text',
              forDevs: row.forDevs,
              contributor: row.contributor || undefined,
              source: 'prompts.chat',
              variables: parsePromptVariables(content),
            },
            $setOnInsert: { title, tags: [] },
          },
          { upsert: true },
        )
        .exec();
      imported += 1;
    }
    return { imported };
  }

  // Paged browse: case-insensitive q across title OR content; optional forDevs
  // filter; title asc. Returns mapped safe shapes.
  async list(opts: MarketplaceListOptions): Promise<Paged<MarketplacePromptModel>> {
    const filter: Record<string, unknown> = {};
    if (opts.q) {
      const rx = { $regex: escapeRegex(opts.q), $options: 'i' };
      filter.$or = [{ title: rx }, { content: rx }];
    }
    if (opts.forDevs !== undefined) filter.forDevs = opts.forDevs;

    const total = await this.model.countDocuments(filter).exec();
    const docs = await this.model
      .find(filter)
      .sort({ title: 1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .exec();
    return {
      items: docs.map(toMarketplacePrompt),
      total,
      page: opts.page,
      limit: opts.limit,
    };
  }

  // Adopt a catalog item into the workspace library: create a real Prompt
  // (placeholders converted to Lyra's {name} syntax) and return its view shape.
  async adopt(
    workspaceId: string,
    userId: string,
    promptId: string,
  ): Promise<PromptModel> {
    const item = await this.model.findById(promptId).exec();
    if (!item) throw new NotFoundException('Marketplace prompt not found');

    const created = await this.prompts.create({
      workspaceId,
      createdBy: userId,
      updatedBy: userId,
      title: item.title,
      content: toLyraPlaceholders(item.content),
      status: PromptStatus.Draft,
      tags: item.tags ?? [],
    });
    return this.prompts.toView(created);
  }
}
