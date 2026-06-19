import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePromptVariables,
  PromptStatus,
  PromptType,
  toLyraPlaceholders,
  type MarketplaceFacets,
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
  types?: string[];
  categories?: string[];
  tags?: string[];
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

  // Global catalog stats for the admin surface: total doc count and the most
  // recent updatedAt (ISO), or null when the catalog is empty.
  async stats(): Promise<{ count: number; lastSyncedAt: string | null }> {
    const count = await this.model.countDocuments().exec();
    const latest = await this.model
      .findOne()
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean()
      .exec();
    const updatedAt = (latest as { updatedAt?: Date } | null)?.updatedAt;
    return {
      count,
      lastSyncedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    };
  }

  // Paged browse: case-insensitive q across title OR content; optional forDevs
  // filter; optional multi-select type/category/tag filters (OR within each
  // group, AND across groups, all case-insensitive — mirrors the prompts list);
  // title asc. Returns mapped safe shapes.
  async list(opts: MarketplaceListOptions): Promise<Paged<MarketplacePromptModel>> {
    const filter: Record<string, unknown> = {};
    if (opts.q) {
      const rx = { $regex: escapeRegex(opts.q), $options: 'i' };
      filter.$or = [{ title: rx }, { content: rx }];
    }
    if (opts.forDevs !== undefined) filter.forDevs = opts.forDevs;
    if (opts.types?.length) {
      filter.type = { $in: opts.types.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) };
    }
    if (opts.categories?.length) {
      filter.category = {
        $in: opts.categories.map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i')),
      };
    }
    if (opts.tags?.length) {
      filter.tags = { $in: opts.tags.map((tag) => new RegExp(`^${escapeRegex(tag)}$`, 'i')) };
    }

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

  // Filter vocabularies for the browse filter: distinct non-empty categories +
  // tags across the whole catalog, each sorted ascending.
  async facets(): Promise<MarketplaceFacets> {
    const [categories, tags] = await Promise.all([
      this.model.distinct('category').exec() as Promise<unknown[]>,
      this.model.distinct('tags').exec() as Promise<unknown[]>,
    ]);
    const clean = (values: unknown[]): string[] =>
      (values.filter((v): v is string => typeof v === 'string' && v.trim() !== '')).sort(
        (a, b) => a.localeCompare(b),
      );
    return { categories: clean(categories), tags: clean(tags) };
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
      // Marketplace prompts use a different (text/structured) enum; map all
      // adopted prompts to the library's Text type for now.
      type: PromptType.Text,
      tags: item.tags ?? [],
    });
    return this.prompts.toView(created);
  }
}
