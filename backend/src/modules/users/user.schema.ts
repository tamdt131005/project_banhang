import { z } from 'zod';

export const userListQuerySchema = z.object({
  /** Tìm theo tên hoặc email. */
  search: z.string().trim().max(191).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  sort: z.enum(['newest', 'orders-desc', 'name']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const roleUpdateSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
