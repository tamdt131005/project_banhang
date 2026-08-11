import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from './error.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export const MAX_IMAGES_PER_REQUEST = 6;

/**
 * Nhận ảnh vào bộ nhớ chứ không ghi thẳng ra đĩa: sharp cần buffer để tạo hai
 * kích thước, ghi ra đĩa rồi đọc lại chỉ tốn thêm một vòng I/O và để lại rác
 * khi xử lý thất bại.
 *
 * fileFilter chỉ là hàng rào đầu tiên — mimetype do client khai báo nên giả
 * mạo được. Hàng rào thật nằm ở sharp trong lib/image.ts, chỗ nào không giải
 * mã được thì bị loại.
 */
const imageFileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    callback(
      AppError.badRequest(
        'UNSUPPORTED_IMAGE',
        `Chỉ nhận ảnh JPEG, PNG, WebP hoặc AVIF. Tệp gửi lên có kiểu ${file.mimetype}.`,
      ),
    );
    return;
  }
  callback(null, true);
};

export const uploadProductImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: MAX_IMAGES_PER_REQUEST,
  },
  fileFilter: imageFileFilter,
}).array('images', MAX_IMAGES_PER_REQUEST);

/** Ảnh đại diện đi một mình một tệp ở field "avatar", cùng hàng rào mimetype. */
export const uploadAvatarImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('avatar');
