import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { PaymentInitResult, PaymentOrderInfo, PaymentProvider } from './types.js';

/**
 * Cổng VNPAY (API PAY v2.1.0 — https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
 *
 * Luồng: tạo đơn → `initiate` ký sẵn URL thanh toán (không gọi mạng) → khách
 * thanh toán trên trang VNPAY → VNPAY gọi IPN và chuyển khách về
 * VNPAY_RETURN_URL.
 *
 * Tham số VNPAY gửi về (IPN lẫn return URL) đều có vnp_SecureHash ký bằng
 * VNPAY_HASH_SECRET, nên kết quả đúng chữ ký được tin như IPN. Trang kết quả
 * vì vậy tự ghi nhận được ở máy local, nơi VNPAY không gọi IPN tới được.
 */

const VERSION = '2.1.0';
/** Thời gian khách được phép ở trang VNPAY trước khi URL hết hạn. */
const EXPIRE_MINUTES = 15;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type VnpayOutcome = 'PAID' | 'PENDING' | 'FAILED';

/** Bảng mã vnp_ResponseCode trong tài liệu VNPAY. */
const RESPONSE_MESSAGES: Record<string, string> = {
  '00': 'Giao dịch thành công.',
  '07': 'Trừ tiền thành công nhưng giao dịch bị nghi ngờ, đang chờ VNPAY xác minh.',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking.',
  '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.',
  '11': 'Đã hết hạn chờ thanh toán.',
  '12': 'Thẻ/tài khoản bị khoá.',
  '13': 'Nhập sai mật khẩu xác thực giao dịch (OTP).',
  '24': 'Khách hàng đã huỷ giao dịch.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản đã vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng thanh toán đang bảo trì.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
};

export function vnpayMessage(responseCode: string): string {
  return RESPONSE_MESSAGES[responseCode] ?? `Giao dịch không thành công (mã ${responseCode}).`;
}

/**
 * Chỉ coi là đã trả khi cả mã phản hồi lẫn tình trạng giao dịch đều là 00.
 * 01 (chưa hoàn tất), 04 (đã trừ tiền nhưng chưa xong ở VNPAY) và 07 (nghi ngờ
 * gian lận) chưa phải kết quả cuối nên để chờ, không đánh dấu thất bại.
 */
export function vnpayOutcome(responseCode: string, transactionStatus: string): VnpayOutcome {
  if (responseCode === '00' && transactionStatus === '00') return 'PAID';
  if (['01', '04', '07'].includes(transactionStatus) || responseCode === '07') return 'PENDING';
  return 'FAILED';
}

export function missingVnpayConfig(): string[] {
  return [
    ['VNPAY_TMN_CODE', env.VNPAY_TMN_CODE],
    ['VNPAY_HASH_SECRET', env.VNPAY_HASH_SECRET],
  ]
    .filter(([, value]) => value === '')
    .map(([name]) => name!);
}

/** vnp_TxnRef phải duy nhất trong ngày nên mỗi lần thanh toán lại có mã mới; mã đơn đứng trước "_". */
function txnRefFor(code: string): string {
  return `${code}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export function orderCodeFromTxnRef(txnRef: string): string {
  return txnRef.split('_')[0] ?? '';
}

/** yyyyMMddHHmmss theo giờ Việt Nam, bất kể múi giờ của server. */
function vnpDate(date: Date): string {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}` +
    `${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`
  );
}

/** vnp_IpAddr dài 7–45 ký tự: "::1" của máy local quá ngắn, IPv4 dạng "::ffff:" thì bóc ra. */
function normalizeIp(ip: string | undefined): string {
  if (!ip || ip === '::1') return '127.0.0.1';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/** Giống urlencode() của PHP trong code mẫu VNPAY: mã hoá mọi ký tự trừ chữ, số và -_. ; dấu cách thành "+". */
function encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** Chuỗi query đã sắp xếp tăng dần theo tên tham số — vừa là dữ liệu ký, vừa là query của URL. */
function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key]!)}`)
    .join('&');
}

function sign(params: Record<string, string>): string {
  return crypto
    .createHmac('sha512', env.VNPAY_HASH_SECRET)
    .update(Buffer.from(canonicalQuery(params), 'utf8'))
    .digest('hex');
}

export interface VnpayResult {
  txnRef: string;
  tmnCode: string;
  /** Đã chia 100, cùng đơn vị với Order.total. */
  amount: number;
  responseCode: string;
  transactionStatus: string;
}

/**
 * Kiểm tra chữ ký trên tham số VNPAY gửi về. Trả null khi sai chữ ký hoặc thiếu
 * trường bắt buộc; chỉ đọc các khoá vnp_ như code mẫu của VNPAY.
 */
export function verifyVnpayParams(query: Record<string, unknown>): VnpayResult | null {
  // Chưa cấu hình thì khoá bí mật rỗng — ai cũng ký được, nên từ chối hết.
  if (missingVnpayConfig().length > 0) return null;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('vnp_') && typeof value === 'string') params[key] = value;
  }
  const given = params['vnp_SecureHash'] ?? '';
  delete params['vnp_SecureHash'];
  delete params['vnp_SecureHashType'];

  const expected = Buffer.from(sign(params), 'hex');
  const actual = Buffer.from(given, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  const { vnp_TxnRef, vnp_TmnCode, vnp_Amount, vnp_ResponseCode, vnp_TransactionStatus } = params;
  if (!vnp_TxnRef || !vnp_TmnCode || !vnp_Amount || !vnp_ResponseCode || !vnp_TransactionStatus) {
    return null;
  }
  return {
    txnRef: vnp_TxnRef,
    tmnCode: vnp_TmnCode,
    amount: Number(vnp_Amount) / 100,
    responseCode: vnp_ResponseCode,
    transactionStatus: vnp_TransactionStatus,
  };
}

export const vnpayProvider: PaymentProvider = {
  method: 'VNPAY',

  get implemented() {
    return missingVnpayConfig().length === 0;
  },

  async initiate(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    const missing = missingVnpayConfig();
    if (missing.length > 0) {
      throw new AppError(
        501,
        'PAYMENT_NOT_IMPLEMENTED',
        'Thanh toán VNPAY chưa được cấu hình. Hiện tại vui lòng chọn thanh toán khi nhận hàng (COD).',
        { missingConfig: missing },
      );
    }

    const now = new Date();
    const params: Record<string, string> = {
      vnp_Version: VERSION,
      vnp_Command: 'pay',
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_Amount: String(order.total * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRefFor(order.code),
      vnp_OrderInfo: order.description,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: env.VNPAY_RETURN_URL,
      vnp_IpAddr: normalizeIp(order.clientIp),
      vnp_CreateDate: vnpDate(now),
      vnp_ExpireDate: vnpDate(new Date(now.getTime() + EXPIRE_MINUTES * 60_000)),
    };

    const redirectUrl = `${env.VNPAY_PAYMENT_URL}?${canonicalQuery(params)}&vnp_SecureHash=${sign(params)}`;
    return { paymentStatus: 'UNPAID', redirectUrl };
  },
};
