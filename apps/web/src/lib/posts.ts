import { api } from './api';
import type { CreatePublishedPostDto, PublishedPost } from '@lyra/shared';

// A project's published-post history. Recorded when a project-scoped publish finishes.
export const postsApi = {
  list: (projectId: string) => api<PublishedPost[]>(`/projects/${projectId}/posts`),
  create: (projectId: string, body: CreatePublishedPostDto) =>
    api<PublishedPost>(`/projects/${projectId}/posts`, { method: 'POST', body: JSON.stringify(body) }),
};
