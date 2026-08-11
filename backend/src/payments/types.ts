import type { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface PaymentOrderInfo {
  code: string;
  total: number;
  description: string;
}

export interface PaymentInitResult {
  paymentStatus: PaymentStatus;
  /** Chỉ có với cổng thanh toán online — khách cần được chuyển tới đây. */
  redirectUrl?: string;
}

/**
 * Mọi hình thức thanh toán đi qua cùng một cửa. Nhờ vậy khi đấu nối MoMo thật
 * thì chỉ phải sửa momo.ts, không phải đụng vào nghiệp vụ đặt hàng.
 */
export interface PaymentProvider {
  readonly method: PaymentMethod;

  /**
   * false khi cổng chưa đấu nối. Nghiệp vụ đặt hàng phải kiểm tra cờ này
   * TRƯỚC khi ghi gì xuống database: phát hiện muộn thì đơn đã tạo và tồn kho
   * đã bị trừ trong khi khách không có cách nào trả tiền.
   */
  readonly implemented: boolean;

  initiate(order: PaymentOrderInfo): Promise<PaymentInitResult>;
}
