import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MODEL_CATALOG, Provider, type ModelOption } from '@lyra/shared';
import { ProviderModel } from './provider-model.schema';
import { KeysService } from '../keys/keys.service';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import {
  OpenAiCompatClient,
  OPENAI_COMPAT_BASE,
} from '../runs/providers/openai-compat.client';
import {
  curateAnthropic,
  curateDeepSeek,
  curateOpenAi,
} from './model-curation';

@Injectable()
export class ModelsService {
  constructor(
    @InjectModel(ProviderModel.name)
    private readonly model: Model<ProviderModel>,
    private readonly keys: KeysService,
    private readonly anthropic: AnthropicClient,
    private readonly openai: OpenAiCompatClient,
  ) {}

  // Fetch live models from the provider (using the workspace key) and store them.
  async refresh(
    workspaceId: string,
    provider: Provider,
    actorId: string,
  ): Promise<ModelOption[]> {
    const key = await this.keys.getDecrypted(workspaceId, provider);
    if (!key) {
      throw new BadRequestException(`Add the "${provider}" key before refreshing models.`);
    }
    const models = await this.fetch(provider, key);
    if (!models.length) {
      throw new BadRequestException('Provider returned no models.');
    }
    await this.model
      .findOneAndUpdate(
        { workspaceId, provider },
        {
          $set: { models, updatedBy: actorId, active: true },
          $setOnInsert: { workspaceId, provider, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return models;
  }

  // Fetch the provider's live models and curate them down to a short list of
  // current flagship chat models (see model-curation.ts).
  private async fetch(provider: Provider, key: string): Promise<ModelOption[]> {
    if (provider === Provider.Anthropic) {
      return curateAnthropic(await this.anthropic.listModels(key));
    }
    const base = OPENAI_COMPAT_BASE[provider];
    if (base) {
      const ids = await this.openai.listModels(base, key);
      return provider === Provider.OpenAI
        ? curateOpenAi(ids)
        : curateDeepSeek(ids);
    }
    throw new BadRequestException(`Model listing isn't supported for ${provider}.`);
  }

  // Effective catalog per provider: stored (refreshed) models if present, else
  // the built-in defaults.
  async effective(workspaceId: string): Promise<Record<Provider, ModelOption[]>> {
    const docs = await this.model.find({ workspaceId, active: { $ne: false } }).exec();
    const stored = new Map(docs.map((d) => [d.provider, d.models]));
    const out = {} as Record<Provider, ModelOption[]>;
    for (const p of Object.values(Provider)) {
      const s = stored.get(p);
      out[p] =
        s && s.length
          ? s.map((m) => ({ id: m.id, label: m.label }))
          : (MODEL_CATALOG[p] ?? []);
    }
    return out;
  }
}
