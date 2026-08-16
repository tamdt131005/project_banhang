import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

/** Ảnh hiển thị ở trang chi tiết. */
const FULL_SIZE = 1200;
/**
 * Ảnh dùng trong lưới sản phẩm — nhỏ để lưới không phải tải ảnh gốc.
 * Cắt 4:5 dọc theo DESIGN.md: thẻ sản phẩm quần áo dùng khung đứng,
 * thumbnail sinh đúng tỉ lệ đó thì trình duyệt không phải cắt lại.
 */
const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 500;

export interface StoredImage {
  url: string;
  thumbUrl: string;
}

function uploadDir() {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

/**
 * Nén ảnh về WebP và sinh sẵn hai kích thước.
 *
 * Lưới sản phẩm là nơi dễ giật nhất: tải 40 ảnh gốc vài MB mỗi ảnh sẽ làm
 * trình duyệt phải giải mã và thu nhỏ toàn bộ. Sinh trước bản 400px khiến
 * việc đó biến mất khỏi phía người dùng.
 */
export async function storeProductImage(buffer: Buffer): Promise<StoredImage> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });

  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
  const fullName = `${name}.webp`;
  const thumbName = `${name}-thumb.webp`;

  try {
    await Promise.all([
      // .rotate() không tham số sẽ xoay ảnh theo thẻ EXIF — nếu bỏ qua thì
      // ảnh chụp bằng điện thoại hay bị nằm ngang.
      sharp(buffer)
        .rotate()
        .resize(FULL_SIZE, FULL_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(dir, fullName)),
      sharp(buffer)
        .rotate()
        .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' })
        .webp({ quality: 78 })
        .toFile(path.join(dir, thumbName)),
    ]);
  } catch {
    // sharp là hàng rào thật sự: mimetype do client khai báo có thể giả mạo,
    // còn tới đây mà không giải mã được thì chắc chắn không phải ảnh.
    throw AppError.badRequest('INVALID_IMAGE', 'Tệp tải lên không phải ảnh hợp lệ.');
  }

  return { url: `/uploads/${fullName}`, thumbUrl: `/uploads/${thumbName}` };
}

/**
 * Ảnh đại diện: một bản vuông duy nhất. 256px đủ nét cho chỗ hiển thị to
 * nhất (48px CSS ≈ 96px màn retina) mà tệp chỉ còn vài KB.
 */
const AVATAR_SIZE = 256;

export async function storeAvatarImage(buffer: Buffer): Promise<string> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });

  const name = `avatar-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.webp`;

  try {
    await sharp(buffer)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toFile(path.join(dir, name));
  } catch {
    throw AppError.badRequest('INVALID_IMAGE', 'Tệp tải lên không phải ảnh hợp lệ.');
  }

  return `/uploads/${name}`;
}

/** Banner trang chủ: một bản WebP rộng, giữ trọn bố cục ảnh ở mọi tỉ lệ màn hình. */
export async function storeBannerImage(buffer: Buffer): Promise<string> {
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });

  const name = `banner-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.webp`;
  const target = path.join(dir, name);

  try {
    await sharp(buffer)
      .rotate()
      .resize(1600, 900, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(target);
  } catch {
    await fs.rm(target, { force: true }).catch(() => undefined);
    throw AppError.badRequest('INVALID_IMAGE', 'Tệp tải lên không phải ảnh hợp lệ.');
  }

  return `/uploads/${name}`;
}

/** Xoá một tệp đã upload theo URL /uploads/... — URL ngoài hệ thống thì bỏ qua. */
export async function deleteUploadedFile(url: string | null): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return;
  await fs.rm(path.join(uploadDir(), path.basename(url)), { force: true });
}

/** Xoá tệp ảnh khỏi ổ đĩa. Bỏ qua nếu tệp đã không còn. */
export async function deleteStoredImage(image: StoredImage): Promise<void> {
  // Ảnh seed trỏ ra ngoài internet, không có tệp nào trên ổ đĩa để xoá.
  await Promise.all([image.url, image.thumbUrl].map((value) => deleteUploadedFile(value)));
}
