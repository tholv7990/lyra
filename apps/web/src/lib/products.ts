import { api } from './api';
import type { Product, CreateProductDto, UpdateProductDto, SaveProductResultDto, ImportedProduct } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/products`;

export const productsApi = {
  list: (ws: string) => api<Product[]>(base(ws)),
  get: (ws: string, id: string) => api<Product>(`${base(ws)}/${id}`),
  create: (ws: string, dto: CreateProductDto) => api<Product>(base(ws), { method: 'POST', body: JSON.stringify(dto) }),
  update: (ws: string, id: string, patch: UpdateProductDto) => api<Product>(`${base(ws)}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (ws: string, id: string) => api<void>(`${base(ws)}/${id}`, { method: 'DELETE' }),
  // One-time crawl + LLM map of an e-commerce URL → unsaved ImportedProduct (prefill only).
  importUrl: (ws: string, url: string) => api<ImportedProduct>(`${base(ws)}/import-url`, { method: 'POST', body: JSON.stringify({ url }) }),
  // Re-crawl the product's stored source URL → refresh commercial fields; returns the updated product.
  resync: (ws: string, id: string) => api<Product>(`${base(ws)}/${id}/resync`, { method: 'POST' }),
};

export const productResultsApi = {
  save: (ws: string, productId: string, dto: SaveProductResultDto) =>
    api<Product>(`/workspaces/${ws}/products/${productId}/results`, { method: 'POST', body: JSON.stringify(dto) }),
  remove: (ws: string, productId: string, resultId: string) =>
    api<Product>(`/workspaces/${ws}/products/${productId}/results/${resultId}`, { method: 'DELETE' }),
};

export const projectProductsApi = {
  list: (projectId: string) => api<Product[]>(`/projects/${projectId}/products`),
  select: (projectId: string, poolProductId: string) => api<Product>(`/projects/${projectId}/products`, { method: 'POST', body: JSON.stringify({ poolProductId }) }),
  refresh: (projectId: string, copyId: string) => api<Product>(`/projects/${projectId}/products/${copyId}/refresh`, { method: 'POST' }),
  unselect: (projectId: string, copyId: string) => api<void>(`/projects/${projectId}/products/${copyId}`, { method: 'DELETE' }),
};
