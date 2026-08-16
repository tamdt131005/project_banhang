import type { ApiBanner, ApiCategory, ApiPaged, ApiProductDetail, ApiProductSummary } from '../types/api';
import { api } from './client';

export const PRODUCT_SORTS = ['newest', 'price-asc', 'price-desc', 'name'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_LABEL: Record<ProductSort, string> = {
  newest: 'Mới nhất',
  'price-asc': 'Giá thấp đến cao',
  'price-desc': 'Giá cao đến thấp',
  name: 'Tên A-Z',
};

export interface ProductQuery {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  /** Lọc theo biến thể còn hàng — xem /api/products/filter-options. */
  size?: string;
  color?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface ApiFilterOptions {
  sizes: string[];
  colors: string[];
}

export const catalogApi = {
  banners: () => api.get<{ banners: ApiBanner[] }>('/api/banners', { placement: 'HOME_HERO' }),

  categories: () => api.get<{ categories: ApiCategory[] }>('/api/categories'),

  filterOptions: () => api.get<ApiFilterOptions>('/api/products/filter-options'),

  products: (query: ProductQuery = {}) =>
    api.get<ApiPaged<ApiProductSummary>>('/api/products', { ...query }),

  product: (slug: string) =>
    api.get<{ product: ApiProductDetail }>(`/api/products/${encodeURIComponent(slug)}`),
};
