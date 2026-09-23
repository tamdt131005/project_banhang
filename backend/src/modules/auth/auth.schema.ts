import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from '../../lib/validators.js';

const fullNameSchema = z.string().trim().min(2, 'Họ tên quá ngắn').max(120, 'Họ tên quá dài');
const otpSchema = z.string().regex(/^\d{6}$/, 'Mã xác nhận gồm 6 chữ số');

export const requestEmailOtpSchema = z.object({
  email: emailSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: phoneSchema.optional(),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: passwordSchema,
}).refine((input) => input.currentPassword !== input.newPassword, {
  path: ['newPassword'],
  message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
});

/** Hồ sơ chỉ sửa được họ tên và SĐT — email là danh tính đăng nhập, không đổi. */
export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  // null = xoá số điện thoại; không gửi trường này = giữ nguyên số cũ.
  phone: phoneSchema.nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RequestEmailOtpInput = z.infer<typeof requestEmailOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
