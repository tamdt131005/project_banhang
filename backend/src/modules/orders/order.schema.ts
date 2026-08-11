import { z } from 'zod';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED',
] as const;

export const orderCreateSchema = z.object({
  addressId: z.coerce.number().int().positive('Vui lòng chọn địa chỉ giao hàng'),
  paymentMethod: z.enum(['COD', 'MOMO']).default('COD'),
  note: z.string().trim().max(500, 'Ghi chú quá dài').optional(),
});

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

/**
 * Bộ lọc dành riêng cho admin. Trang khách không cần tìm theo mã hay theo
 * người mua nên không dùng chung schema — mỗi bên một bộ, khỏi lộ tham số
 * lọc chéo tài khoản ra API công khai.
 */
export const adminOrderListQuerySchema = orderListQuerySchema.extend({
  /** Tìm theo mã đơn, tên hoặc email người mua. */
  search: z.string().trim().max(191).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID', 'FAILED']).optional(),
  paymentMethod: z.enum(['COD', 'MOMO']).optional(),
  /** Khoảng ngày đặt, dạng YYYY-MM-DD. */
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ').optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ').optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

/**
 * Đánh dấu thanh toán thủ công: đơn chuyển khoản trước hoặc thu tiền hộ báo
 * thất bại đều cần admin ghi nhận, máy trạng thái đơn không suy ra được.
 */
export const paymentStatusSchema = z.object({
  paymentStatus: z.enum(['UNPAID', 'PAID', 'FAILED']),
});

export const orderCodeParamSchema = z.object({
  code: z.string().trim().min(3).max(32),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
