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

// A text chat/reasoning model from OpenAI's catalog (excludes image, audio,
// tts, transcribe, realtime, whisper, embeddings, moderation, dall-e).
const OPENAI_CHAT_PREFIX = /^(gpt-\d|o\d|chatgpt)/i;
const OPENAI_NON_TEXT =
  /(image|audio|tts|transcribe|realtime|whisper|embedding|moderation|dall-e)/i;
function isOpenAiChatModel(id: string): boolean {
  return OPENAI_CHAT_PREFIX.test(id) && !OPENAI_NON_TEXT.test(id);
}

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

  private async fetch(provider: Provider, key: string): Promise<ModelOption[]> {
    if (provider === Provider.Anthropic) {
      return this.anthropic.listModels(key);
    }
    const base = OPENAI_COMPAT_BASE[provider];
    if (base) {
      const ids = await this.openai.listModels(base, key);
      // OpenAI's /models lists every modality. Keep text chat/reasoning models
      // (gpt-*, o1/o3/o4, chatgpt-*) and drop image/audio/tts/transcribe/etc.,
      // which aren't usable in a text prompt picker. DeepSeek is already clean.
      const filtered =
        provider === Provider.OpenAI ? ids.filter(isOpenAiChatModel) : ids;
      return [...filtered].sort().map((id) => ({ id, label: id }));
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
