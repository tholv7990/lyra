import { api } from './api';
import type { Product, UpdateProductDto } from '@lyra/shared';

const base = (projectId: string) => `/projects/${projectId}/products`;

export const productsApi = {
  list: (projectId: string) => api<Product[]>(base(projectId)),
  get: (projectId: string, id: string) => api<Product>(`${base(projectId)}/${id}`),
  update: (projectId: string, id: string, patch: UpdateProductDto) =>
    api<Product>(`${base(projectId)}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};
