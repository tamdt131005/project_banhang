import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

/**
 * Lỗi có chủ đích do tầng nghiệp vụ ném ra. Mọi lỗi loại này được trả nguyên
 * văn cho client; những lỗi khác bị quy về 500 và giấu chi tiết.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Bạn cần đăng nhập để thực hiện thao tác này.') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Không tìm thấy dữ liệu.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new AppError(409, code, message, details);
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Không có endpoint ${req.method} ${req.originalUrl}`,
    },
  });
};

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(gốc)',
    message: issue.message,
  }));
}

/**
 * Express 5 tự chuyển promise bị reject vào đây, nên controller dùng async
 * không cần bọc thêm asyncHandler.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ.',
        details: zodDetails(err),
      },
    });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh vượt quá dung lượng cho phép.'
        : `Tải ảnh lên thất bại (${err.code}).`;
    res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.['target'];
        res.status(409).json({
          error: {
            code: 'DUPLICATE',
            message: 'Giá trị này đã tồn tại.',
            ...(target === undefined ? {} : { details: { field: target } }),
          },
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu cần thao tác.' },
        });
        return;
      case 'P2003':
        res.status(409).json({
          error: {
            code: 'FK_CONSTRAINT',
            message: 'Dữ liệu đang được tham chiếu ở nơi khác nên không thể thao tác.',
          },
        });
        return;
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('[db] không kết nối được database:', err.message);
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Không kết nối được tới database. Kiểm tra MySQL trong Laragon đã bật chưa.',
      },
    });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Máy chủ gặp sự cố. Vui lòng thử lại sau.'
        : err instanceof Error
          ? err.message
          : String(err),
    },
  });
};
