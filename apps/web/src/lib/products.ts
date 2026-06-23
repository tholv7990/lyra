import { api } from './api';
import type { Product, CreateProductDto, UpdateProductDto } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/products`;

export const productsApi = {
  list: (ws: string) => api<Product[]>(base(ws)),
  get: (ws: string, id: string) => api<Product>(`${base(ws)}/${id}`),
  create: (ws: string, dto: CreateProductDto) => api<Product>(base(ws), { method: 'POST', body: JSON.stringify(dto) }),
  update: (ws: string, id: string, patch: UpdateProductDto) => api<Product>(`${base(ws)}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (ws: string, id: string) => api<void>(`${base(ws)}/${id}`, { method: 'DELETE' }),
};
