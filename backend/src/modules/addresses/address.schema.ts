import { z } from 'zod';
import { phoneSchema } from '../../lib/validators.js';

export const addressCreateSchema = z.object({
  fullName: z.string().trim().min(2, 'Tên người nhận quá ngắn').max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(3, 'Địa chỉ quá ngắn').max(255),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã').max(120),
  district: z.string().trim().min(1, 'Vui lòng nhập quận/huyện').max(120),
  province: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(120),
  isDefault: z.boolean().optional(),
});

/**
 * Sửa địa chỉ không đổi được cờ mặc định: bỏ cờ ở đây sẽ để tài khoản không
 * còn địa chỉ mặc định nào. Muốn đổi thì gọi POST /addresses/:id/default.
 */
export const addressUpdateSchema = addressCreateSchema.omit({ isDefault: true }).partial();

export type AddressCreateInput = z.infer<typeof addressCreateSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
