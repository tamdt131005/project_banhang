import type { ApiCart } from '../types/api';
import { api } from './client';

export const cartApi = {
  get: () => api.get<{ cart: ApiCart }>('/api/cart'),

  add: (variantId: number, quantity = 1) =>
    api.post<{ cart: ApiCart }>('/api/cart/items', { variantId, quantity }),

  setQuantity: (itemId: number, quantity: number) =>
    api.patch<{ cart: ApiCart }>(`/api/cart/items/${itemId}`, { quantity }),

  remove: (itemId: number) => api.delete<{ cart: ApiCart }>(`/api/cart/items/${itemId}`),

  clear: () => api.delete<{ cart: ApiCart }>('/api/cart'),
};
