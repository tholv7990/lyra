import { api } from './api';
import type { Prompt, SaveResultDto } from '@lyra/shared';

// Saved results are children of a prompt; the api re-resolves access via the
// prompt id (no workspace in the path). Each call returns the updated prompt.

export const saveResult = (promptId: string, body: SaveResultDto) =>
  api<Prompt>(`/prompts/${promptId}/results`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteResult = (promptId: string, resultId: string) =>
  api<Prompt>(`/prompts/${promptId}/results/${resultId}`, { method: 'DELETE' });
