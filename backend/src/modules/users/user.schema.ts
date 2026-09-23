import { z } from 'zod';
import { STAFF_PERMISSIONS } from '../permissions/permission.constants.js';

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

export const staffAccessSchema = z.object({
  role: z.enum(['USER', 'STAFF']),
  permissions: z.array(z.enum(STAFF_PERMISSIONS)).max(STAFF_PERMISSIONS.length),
}).superRefine((input, context) => {
  if (input.role === 'USER' && input.permissions.length > 0) {
    context.addIssue({ code: 'custom', message: 'Khách hàng không thể có quyền quản trị.', path: ['permissions'] });
  }
  if (input.role === 'STAFF' && input.permissions.length === 0) {
    context.addIssue({ code: 'custom', message: 'Nhân viên cần ít nhất một quyền.', path: ['permissions'] });
  }
  if (new Set(input.permissions).size !== input.permissions.length) {
    context.addIssue({ code: 'custom', message: 'Không thể chọn trùng quyền.', path: ['permissions'] });
  }
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type StaffAccessInput = z.infer<typeof staffAccessSchema>;
