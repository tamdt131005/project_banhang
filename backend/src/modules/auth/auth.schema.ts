import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from '../../lib/validators.js';

const fullNameSchema = z.string().trim().min(2, 'Họ tên quá ngắn').max(120, 'Họ tên quá dài');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

/** Hồ sơ chỉ sửa được họ tên và SĐT — email là danh tính đăng nhập, không đổi. */
export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  // null = xoá số điện thoại; không gửi trường này = giữ nguyên số cũ.
  phone: phoneSchema.nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
