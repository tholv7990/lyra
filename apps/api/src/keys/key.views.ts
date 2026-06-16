import { Provider } from '@lyra/shared';
import type { ApiKeyInfo, UserRef } from '@lyra/shared';
import { BadRequestException } from '@nestjs/common';
import type { ApiKeyDocument } from './api-key.schema';
import { userRef } from '../common/refs';

// Safe transport shape — never includes encryptedKey.
export function toApiKeyInfo(
  k: ApiKeyDocument,
  refs: Map<string, UserRef>,
): ApiKeyInfo {
  return {
    id: k._id.toString(),
    workspaceId: k.workspaceId,
    provider: k.provider,
    last4: k.last4,
    active: k.active,
    createdBy: userRef(k.createdBy, refs),
    updatedBy: userRef(k.updatedBy, refs),
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  };
}

const PROVIDERS = Object.values(Provider) as string[];

export function parseProvider(value: string): Provider {
  if (!PROVIDERS.includes(value)) {
    throw new BadRequestException(`Unknown provider: ${value}`);
  }
  return value as Provider;
}
