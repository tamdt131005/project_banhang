import type { PaymentInitResult, PaymentProvider } from './types.js';

/**
 * Thanh toán khi nhận hàng: không có bước online nào cả. Đơn được tạo ở trạng
 * thái chưa thanh toán, tiền thu lúc giao. Admin đánh dấu đã thu bằng cách
 * chuyển trạng thái đơn sang DELIVERED.
 */
export const codProvider: PaymentProvider = {
  method: 'COD',
  implemented: true,

  initiate(): Promise<PaymentInitResult> {
    return Promise.resolve({ paymentStatus: 'UNPAID' });
  },
};
