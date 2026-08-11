import { z } from 'zod';

/** Số điện thoại Việt Nam: 10 chữ số, bắt đầu bằng 0. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0');

export const emailSchema = z
  .email('Email không hợp lệ')
  .max(191, 'Email quá dài')
  .transform((value) => value.trim().toLowerCase());

/** bcrypt chỉ dùng 72 byte đầu, nên chặn ở đó thay vì âm thầm cắt bớt. */
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .max(72, 'Mật khẩu không được quá 72 ký tự');

/** Dùng cho mọi route dạng /:id. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Mã không hợp lệ'),
});

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(191),
});
