import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator, MemoryStore } from 'express-rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Giữ tham chiếu tới mọi store để test có thể xoá bộ đếm giữa các case.
 * Không có nó thì một test đăng nhập sai 11 lần sẽ làm hỏng các test chạy sau.
 */
const stores: MemoryStore[] = [];

function newStore() {
  const store = new MemoryStore();
  stores.push(store);
  return store;
}

export async function resetAllRateLimits() {
  await Promise.all(stores.map((store) => store.resetAll()));
}

function reject(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
  };
}

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
} as const;

/** Trần chung cho toàn bộ /api. Không tính endpoint health để giám sát không bị chặn. */
export const apiLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: 15 * MINUTE,
  limit: 300,
  skip: (req) => req.path === '/health',
  handler: reject('Bạn gửi quá nhiều yêu cầu. Vui lòng chờ ít phút rồi thử lại.'),
});

/**
 * Chống dò mật khẩu. Khoá đếm gồm cả email chứ không chỉ IP: nếu chỉ theo IP
 * thì một người dò mật khẩu sẽ khoá luôn mọi người dùng chung đường mạng
 * (văn phòng, ký túc xá, quán net).
 *
 * `skipSuccessfulRequests` khiến chỉ lần đăng nhập THẤT BẠI mới bị tính, nên
 * người dùng hợp lệ đăng nhập nhiều lần không bao giờ chạm ngưỡng.
 */
export const loginLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
  handler: reject('Sai thông tin đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.'),
});

/** Chặn tạo tài khoản hàng loạt. Khoá theo IP vì email lúc này chưa đáng tin. */
export const registerLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: HOUR,
  limit: 10,
  handler: reject('Đã tạo quá nhiều tài khoản từ địa chỉ này. Vui lòng thử lại sau 1 giờ.'),
});

/** Keep OTP delivery bounded per IP and normalized email address. */
export const emailOtpRequestLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: HOUR,
  limit: 5,
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
  handler: reject('Bạn yêu cầu mã xác nhận quá nhiều lần. Vui lòng thử lại sau.'),
});

export const emailOtpVerifyLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: 15 * MINUTE,
  limit: 20,
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
  handler: reject('Bạn nhập mã xác nhận quá nhiều lần. Vui lòng thử lại sau.'),
});

export const refreshLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: 15 * MINUTE,
  limit: 60,
  handler: reject('Phiên làm mới quá dày. Vui lòng tải lại trang.'),
});

/**
 * Các limiter dưới đây khoá theo userId nên PHẢI đặt sau `requireAuth`
 * trong chuỗi middleware, nếu không `req.user` còn undefined và sẽ rơi về IP.
 */
function perUserKey(req: Request) {
  return req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? '');
}

export const changePasswordLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: HOUR,
  limit: 10,
  keyGenerator: perUserKey,
  handler: reject('Bạn thử đổi mật khẩu quá nhiều lần. Vui lòng chờ 1 giờ.'),
});

export const orderLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: HOUR,
  limit: 20,
  keyGenerator: perUserKey,
  handler: reject('Bạn đặt quá nhiều đơn trong một giờ. Vui lòng thử lại sau.'),
});

export const uploadLimiter = rateLimit({
  ...shared,
  store: newStore(),
  windowMs: HOUR,
  limit: 50,
  keyGenerator: perUserKey,
  handler: reject('Bạn tải lên quá nhiều ảnh trong một giờ. Vui lòng thử lại sau.'),
});
