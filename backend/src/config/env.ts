import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'thiếu chuỗi kết nối database'),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  /**
   * Số tầng proxy tin cậy phía trước server. Mặc định 0 = không tin ai, nên
   * `req.ip` luôn là địa chỉ TCP thật. Chỉ tăng lên khi thực sự chạy sau
   * nginx/Cloudflare — bật bừa sẽ cho phép giả mạo IP qua X-Forwarded-For và
   * vô hiệu hoá toàn bộ rate limit.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  JWT_ACCESS_SECRET: z.string().min(16, 'cần ít nhất 16 ký tự'),
  JWT_REFRESH_SECRET: z.string().min(16, 'cần ít nhất 16 ký tự'),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('7d'),

  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(5),

  SHIPPING_FEE: z.coerce.number().int().nonnegative().default(30_000),

  MOMO_PARTNER_CODE: z.string().default(''),
  MOMO_ACCESS_KEY: z.string().default(''),
  MOMO_SECRET_KEY: z.string().default(''),
  MOMO_ENDPOINT: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(
    `\nCấu hình môi trường không hợp lệ. Kiểm tra lại backend/.env:\n${issues}\n\n` +
      'Chưa có file .env? Chạy:  copy backend\\.env.example backend\\.env\n',
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
