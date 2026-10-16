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

export interface CreateOrderResult {
  order: ApiOrder;
  /** Có với cổng online (MoMo): chuyển khách tới đây để thanh toán. */
  paymentUrl?: string;
  /** Đơn đã tạo nhưng chưa mở được cổng thanh toán; khách thanh toán lại ở trang đơn. */
  paymentError?: string;
}

/** Khớp MomoOutcome trong backend/src/payments/momo.ts. */
export type MomoOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN';

export interface OrderListQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export const orderApi = {
  create: (input: CreateOrderInput) => api.post<CreateOrderResult>('/api/orders', input),

  payMomo: (code: string) =>
    api.post<{ paymentUrl: string }>(`/api/orders/${encodeURIComponent(code)}/momo`),

  verifyMomo: (code: string, momoOrderId: string) =>
    api.post<{ order: ApiOrder; outcome: MomoOutcome; message: string }>(
      `/api/orders/${encodeURIComponent(code)}/momo/verify`,
      { momoOrderId },
    ),

  listMine: (query: OrderListQuery = {}) => api.get<ApiPaged<ApiOrder>>('/api/orders', { ...query }),

  getMine: (code: string) =>
    api.get<{ order: ApiOrder }>(`/api/orders/${encodeURIComponent(code)}`),

  cancel: (code: string, input: CancelReasonPayload) =>
    api.post<{ order: ApiOrder; replayed?: boolean }>(
      `/api/orders/${encodeURIComponent(code)}/cancel`,
      input,
    ),
};
