import type { OrderStatus } from '../lib/format';
import type { CancelReasonPayload } from '../lib/order-cancel';
import type { ApiOrder, ApiPaged } from '../types/api';
import { api } from './client';

export interface CreateOrderInput {
  addressId: number;
  paymentMethod: 'COD' | 'MOMO';
  note?: string;
  /** Có mặt thì đơn chỉ gồm biến thể này và không đụng giỏ hàng. */
  buyNow?: { variantId: number; quantity: number };
}

export interface OrderListQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export const orderApi = {
  create: (input: CreateOrderInput) => api.post<{ order: ApiOrder }>('/api/orders', input),

  listMine: (query: OrderListQuery = {}) => api.get<ApiPaged<ApiOrder>>('/api/orders', { ...query }),

  getMine: (code: string) =>
    api.get<{ order: ApiOrder }>(`/api/orders/${encodeURIComponent(code)}`),

  cancel: (code: string, input: CancelReasonPayload) =>
    api.post<{ order: ApiOrder; replayed?: boolean }>(
      `/api/orders/${encodeURIComponent(code)}/cancel`,
      input,
    ),
};
