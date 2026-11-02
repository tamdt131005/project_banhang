import type { OrderStatus } from '../lib/format';
import type { CancelReasonPayload } from '../lib/order-cancel';
import type { ApiOrder, ApiPaged } from '../types/api';
import { api } from './client';

export interface CreateOrderInput {
  addressId: number;
  paymentMethod: 'COD' | 'MOMO' | 'VNPAY';
  note?: string;
  /** Có mặt thì đơn chỉ gồm biến thể này và không đụng giỏ hàng. */
  buyNow?: { variantId: number; quantity: number };
}

export interface CreateOrderResult {
  order: ApiOrder;
  /** Có với cổng online (MoMo, VNPAY): chuyển khách tới đây để thanh toán. */
  paymentUrl?: string;
  /** Đơn đã tạo nhưng chưa mở được cổng thanh toán; khách thanh toán lại ở trang đơn. */
  paymentError?: string;
}

/** Khớp MomoOutcome trong backend/src/payments/momo.ts. */
export type MomoOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN';

/** Khớp VnpayOutcome trong backend/src/payments/vnpay.ts. */
export type VnpayOutcome = 'PAID' | 'PENDING' | 'FAILED';

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

  payVnpay: (code: string) =>
    api.post<{ paymentUrl: string }>(`/api/orders/${encodeURIComponent(code)}/vnpay`),

  /** Gửi nguyên các tham số vnp_ trên URL trả về; backend kiểm chữ ký rồi mới cập nhật đơn. */
  verifyVnpay: (code: string, params: Record<string, string>) =>
    api.post<{ order: ApiOrder; outcome: VnpayOutcome; message: string }>(
      `/api/orders/${encodeURIComponent(code)}/vnpay/verify`,
      { params },
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
