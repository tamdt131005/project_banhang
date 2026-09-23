import { z } from 'zod';
import { STAFF_PERMISSIONS } from '../permissions/permission.constants.js';
import { emailSchema, passwordSchema, phoneSchema } from '../../lib/validators.js';

export const userListQuerySchema = z.object({
  /** Tìm theo tên hoặc email. */
  search: z.string().trim().max(191).optional(),
  role: z.enum(['USER', 'STAFF', 'ADMIN']).optional(),
  sort: z.enum(['newest', 'orders-desc', 'name']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const roleUpdateSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

const permissionsSchema = z.array(z.enum(STAFF_PERMISSIONS))
  .min(1, 'Nhân viên cần ít nhất một quyền.')
  .max(STAFF_PERMISSIONS.length)
  .refine((permissions) => new Set(permissions).size === permissions.length, 'Không thể chọn trùng quyền.');

export const staffAccessSchema = z.object({
  permissions: permissionsSchema,
}).strict();

export const staffCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Họ tên quá ngắn').max(120, 'Họ tên quá dài'),
  phone: phoneSchema.optional(),
  permissions: permissionsSchema,
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type StaffAccessInput = z.infer<typeof staffAccessSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
