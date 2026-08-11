import { z } from 'zod';
import { vi } from 'zod/locales';

/**
 * Bật bộ thông báo lỗi tiếng Việt dựng sẵn của zod.
 *
 * Không có dòng này thì những lỗi mặc định (thiếu trường bắt buộc, sai kiểu)
 * sẽ hiện ra tiếng Anh — "Invalid input: expected string, received undefined" —
 * lẫn lộn với các thông báo tiếng Việt tự viết trong từng schema.
 *
 * Import ở app.ts để chắc chắn chạy trước mọi lần parse.
 */
z.config(vi());
