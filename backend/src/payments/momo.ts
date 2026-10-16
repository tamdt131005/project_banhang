import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { PaymentInitResult, PaymentOrderInfo, PaymentProvider } from './types.js';

/**
 * Cổng MoMo (API v2 — https://developers.momo.vn/v3/docs/payment/api/wallet/onetime).
 *
 * Luồng: tạo đơn → `initiate` lấy payUrl → khách thanh toán trên trang MoMo →
 * MoMo gọi IPN (server-to-server) và chuyển khách về MOMO_REDIRECT_URL.
 *
 * Chỉ IPN có chữ ký hợp lệ hoặc kết quả tự tra cứu qua API query mới được phép
 * đánh dấu đơn đã thanh toán; tham số trên URL redirect có thể bị giả mạo.
 * Ở máy local MoMo không gọi IPN tới được, nên trang kết quả nhờ backend tra
 * cứu lại giao dịch.
 */

/** Trang MoMo cho khách tự chọn ví, thẻ ATM nội địa hoặc thẻ quốc tế. */
const REQUEST_TYPE = 'payWithMethod';

/** MoMo yêu cầu chờ tối thiểu 30 giây cho create và query. */
const TIMEOUT_MS = 30_000;

const SUCCESS_CODES = new Set([0, 9000]);
const PENDING_CODES = new Set([1000, 7000, 7002]);

export type MomoOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN';

/** Bảng mã: https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode */
export function momoOutcome(resultCode: number): MomoOutcome {
  if (SUCCESS_CODES.has(resultCode)) return 'PAID';
  if (PENDING_CODES.has(resultCode)) return 'PENDING';
  // 98, 99 và nhóm trên 1000 là trạng thái cuối của một giao dịch thất bại.
  // Các mã nhỏ hơn là lỗi của chính yêu cầu nên chưa nói gì về giao dịch.
  if (resultCode === 98 || resultCode === 99 || resultCode > 1000) return 'FAILED';
  return 'UNKNOWN';
}

export function missingMomoConfig(): string[] {
  return [
    ['MOMO_PARTNER_CODE', env.MOMO_PARTNER_CODE],
    ['MOMO_ACCESS_KEY', env.MOMO_ACCESS_KEY],
    ['MOMO_SECRET_KEY', env.MOMO_SECRET_KEY],
    ['MOMO_ENDPOINT', env.MOMO_ENDPOINT],
  ]
    .filter(([, value]) => value === '')
    .map(([name]) => name!);
}

/**
 * orderId gửi MoMo phải duy nhất cho mỗi lần thanh toán, nên một đơn thanh
 * toán lại sẽ có nhiều orderId. Mã đơn luôn đứng trước dấu "_" đầu tiên.
 */
function momoOrderIdFor(code: string): string {
  return `${code}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export function orderCodeFromMomoOrderId(momoOrderId: string): string {
  return momoOrderId.split('_')[0] ?? '';
}

function sign(rawSignature: string): string {
  return crypto.createHmac('sha256', env.MOMO_SECRET_KEY).update(rawSignature).digest('hex');
}

async function callMomo<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.MOMO_ENDPOINT.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AppError(502, 'MOMO_UNAVAILABLE', 'Không kết nối được tới MoMo. Vui lòng thử lại sau.');
  }

  // MoMo trả lỗi nghiệp vụ kèm resultCode trong body, kể cả với HTTP 4xx.
  const data: unknown = await response.json().catch(() => null);
  if (data === null || typeof data !== 'object' || !('resultCode' in data)) {
    throw new AppError(502, 'MOMO_BAD_RESPONSE', 'MoMo trả về dữ liệu không hợp lệ.');
  }
  return data as T;
}

interface MomoCreateResponse {
  resultCode: number;
  message?: string;
  payUrl?: string;
}

export interface MomoTransaction {
  partnerCode: string;
  orderId: string;
  amount: number;
  resultCode: number;
  message?: string;
}

/** Tra cứu trạng thái giao dịch trực tiếp từ MoMo. */
export function queryMomoTransaction(momoOrderId: string): Promise<MomoTransaction> {
  const requestId = crypto.randomUUID();
  const rawSignature =
    `accessKey=${env.MOMO_ACCESS_KEY}&orderId=${momoOrderId}` +
    `&partnerCode=${env.MOMO_PARTNER_CODE}&requestId=${requestId}`;

  return callMomo<MomoTransaction>('/v2/gateway/api/query', {
    partnerCode: env.MOMO_PARTNER_CODE,
    requestId,
    orderId: momoOrderId,
    lang: 'vi',
    signature: sign(rawSignature),
  });
}

/** Các trường MoMo gửi tới ipnUrl, giữ nguyên dạng chuỗi để dựng lại chữ ký. */
export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: string;
  orderInfo: string;
  orderType: string;
  transId: string;
  resultCode: string;
  message: string;
  payType: string;
  responseTime: string;
  extraData: string;
  signature: string;
}

export function verifyMomoIpn(payload: MomoIpnPayload): boolean {
  // Chưa cấu hình thì khoá bí mật rỗng — ai cũng ký được, nên từ chối hết.
  if (missingMomoConfig().length > 0) return false;

  const rawSignature =
    `accessKey=${env.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData}` +
    `&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}` +
    `&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;

  const expected = Buffer.from(sign(rawSignature), 'hex');
  const given = Buffer.from(payload.signature, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export const momoProvider: PaymentProvider = {
  method: 'MOMO',

  get implemented() {
    return missingMomoConfig().length === 0;
  },

  async initiate(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    const missing = missingMomoConfig();
    if (missing.length > 0) {
      throw new AppError(
        501,
        'PAYMENT_NOT_IMPLEMENTED',
        'Thanh toán MoMo chưa được cấu hình. Hiện tại vui lòng chọn thanh toán khi nhận hàng (COD).',
        { missingConfig: missing },
      );
    }

    const orderId = momoOrderIdFor(order.code);
    const requestId = orderId;
    const extraData = '';
    const rawSignature =
      `accessKey=${env.MOMO_ACCESS_KEY}&amount=${order.total}&extraData=${extraData}` +
      `&ipnUrl=${env.MOMO_IPN_URL}&orderId=${orderId}&orderInfo=${order.description}` +
      `&partnerCode=${env.MOMO_PARTNER_CODE}&redirectUrl=${env.MOMO_REDIRECT_URL}` +
      `&requestId=${requestId}&requestType=${REQUEST_TYPE}`;

    const data = await callMomo<MomoCreateResponse>('/v2/gateway/api/create', {
      partnerCode: env.MOMO_PARTNER_CODE,
      requestId,
      amount: order.total,
      orderId,
      orderInfo: order.description,
      redirectUrl: env.MOMO_REDIRECT_URL,
      ipnUrl: env.MOMO_IPN_URL,
      requestType: REQUEST_TYPE,
      extraData,
      lang: 'vi',
      signature: sign(rawSignature),
    });

    if (data.resultCode !== 0 || !data.payUrl) {
      throw new AppError(
        502,
        'MOMO_CREATE_FAILED',
        `MoMo từ chối tạo giao dịch: ${data.message ?? 'không rõ lý do'}`,
        { resultCode: data.resultCode },
      );
    }

    return { paymentStatus: 'UNPAID', redirectUrl: data.payUrl };
  },
};
