import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { PaymentInitResult, PaymentProvider } from './types.js';

/**
 * Chỗ đặt sẵn cho MoMo — CHƯA ĐẤU NỐI.
 *
 * Khi làm thật, phần còn thiếu nằm gọn trong `initiate`:
 *   1. Dựng payload: partnerCode, requestId, orderId, amount, orderInfo,
 *      redirectUrl, ipnUrl, requestType = 'captureWallet'.
 *   2. Ký HMAC-SHA256 chuỗi rawSignature bằng MOMO_SECRET_KEY.
 *   3. POST tới MOMO_ENDPOINT, lấy `payUrl` trả về làm redirectUrl.
 *
 * Ngoài ra còn cần một endpoint IPN nhận callback từ MoMo để cập nhật
 * paymentStatus — đó là nơi duy nhất được phép đánh dấu đơn đã thanh toán,
 * vì redirect phía trình duyệt có thể bị giả mạo.
 */
export const momoProvider: PaymentProvider = {
  method: 'MOMO',
  implemented: false,

  initiate(): Promise<PaymentInitResult> {
    const missing = [
      ['MOMO_PARTNER_CODE', env.MOMO_PARTNER_CODE],
      ['MOMO_ACCESS_KEY', env.MOMO_ACCESS_KEY],
      ['MOMO_SECRET_KEY', env.MOMO_SECRET_KEY],
      ['MOMO_ENDPOINT', env.MOMO_ENDPOINT],
    ]
      .filter(([, value]) => value === '')
      .map(([name]) => name);

    throw new AppError(
      501,
      'PAYMENT_NOT_IMPLEMENTED',
      'Thanh toán MoMo chưa được đấu nối. Hiện tại vui lòng chọn thanh toán khi nhận hàng (COD).',
      missing.length > 0 ? { missingConfig: missing } : undefined,
    );
  },
};
