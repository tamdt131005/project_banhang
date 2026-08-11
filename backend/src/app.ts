import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
// Phải nạp trước mọi schema parse để lỗi zod hiện bằng tiếng Việt.
import './config/zod.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { apiRouter } from './routes.js';

/**
 * Tạo app nhưng KHÔNG gọi listen, để test dùng lại được qua supertest.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Mặc định TRUST_PROXY=0: req.ip là địa chỉ TCP thật, không đọc
  // X-Forwarded-For. Bật lên chỉ khi thực sự có proxy phía trước, nếu không
  // ai cũng tự đặt được header đó và rate limit thành vô nghĩa.
  if (env.TRUST_PROXY > 0) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Ảnh sản phẩm đã upload. Đường dẫn tính từ thư mục backend/ vì mọi lệnh
  // npm của backend đều chạy từ đó.
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), { maxAge: '7d' }),
  );

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
