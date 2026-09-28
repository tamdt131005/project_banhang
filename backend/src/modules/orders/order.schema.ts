import { z } from 'zod';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED',
] as const;

/** Mua ngay một biến thể, không lấy và không xoá giỏ hàng. */
const buyNowSchema = z.object({
  variantId: z.coerce.number().int().positive('Biến thể sản phẩm không hợp lệ'),
  quantity: z.coerce
    .number()
    .int('Số lượng phải là số nguyên')
    .positive('Số lượng phải lớn hơn 0')
    .max(99, 'Mỗi sản phẩm chỉ mua tối đa 99 cái một lần'),
});

export const orderCreateSchema = z.object({
  addressId: z.coerce.number().int().positive('Vui lòng chọn địa chỉ giao hàng'),
  paymentMethod: z.enum(['COD', 'MOMO']).default('COD'),
  note: z.string().trim().max(500, 'Ghi chú quá dài').optional(),
  buyNow: buyNowSchema.optional(),
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

/**
 * Lý do huỷ do khách chọn. `OTHER` nghĩa là tự điền — khi đó `reason` là bắt buộc.
 * Nhãn lưu vào lịch sử trạng thái, mã chỉ dùng trên API.
 */
export const CUSTOMER_CANCEL_REASON_CODES = [
  'CHANGED_MIND',
  'WRONG_ITEM',
  'CHANGE_ADDRESS',
  'FOUND_BETTER_PRICE',
  'WAIT_TOO_LONG',
  'OTHER',
] as const;

export const CUSTOMER_CANCEL_REASON_LABEL = {
  CHANGED_MIND: 'Đổi ý, không muốn mua nữa',
  WRONG_ITEM: 'Đặt nhầm sản phẩm, size hoặc màu',
  CHANGE_ADDRESS: 'Muốn đổi địa chỉ hoặc thông tin nhận hàng',
  FOUND_BETTER_PRICE: 'Tìm được nơi khác phù hợp hơn',
  WAIT_TOO_LONG: 'Chờ xử lý đơn quá lâu',
} as const;

/** Lý do huỷ do nhân viên chọn. Khác danh sách của khách vì ngữ cảnh khác. */
export const ADMIN_CANCEL_REASON_CODES = [
  'CUSTOMER_REQUEST',
  'OUT_OF_STOCK',
  'UNREACHABLE',
  'INVALID_ADDRESS',
  'PAYMENT_ISSUE',
  'OTHER',
] as const;

export const ADMIN_CANCEL_REASON_LABEL = {
  CUSTOMER_REQUEST: 'Khách yêu cầu huỷ',
  OUT_OF_STOCK: 'Hết hàng hoặc không đủ tồn kho',
  UNREACHABLE: 'Không liên hệ được khách',
  INVALID_ADDRESS: 'Thông tin giao hàng không hợp lệ',
  PAYMENT_ISSUE: 'Thanh toán không thành công',
} as const;

const cancelReasonText = z.string().trim().max(500, 'Lý do huỷ quá dài');

function requireCancelReason(
  value: { reasonCode?: string; reason?: string },
  labels: Record<string, string>,
  ctx: z.RefinementCtx,
) {
  if (value.reasonCode && value.reasonCode !== 'OTHER' && labels[value.reasonCode]) return;
  if (value.reason && value.reason.length > 0) return;
  ctx.addIssue({
    code: 'custom',
    path: ['reason'],
    message: 'Vui lòng chọn lý do có sẵn hoặc tự điền lý do huỷ đơn',
  });
}

export const customerCancelSchema = z
  .object({
    reasonCode: z.enum(CUSTOMER_CANCEL_REASON_CODES).optional(),
    reason: cancelReasonText.optional(),
  })
  .superRefine((value, ctx) => {
    requireCancelReason(value, CUSTOMER_CANCEL_REASON_LABEL, ctx);
  });

export const orderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    reasonCode: z.enum(ADMIN_CANCEL_REASON_CODES).optional(),
    reason: cancelReasonText.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== 'CANCELLED') return;
    requireCancelReason(value, ADMIN_CANCEL_REASON_LABEL, ctx);
  });

/** Nhãn lý do có sẵn được ưu tiên; tự điền chỉ dùng khi không chọn mã có sẵn. */
export function resolveCancelReason(
  input: { reasonCode?: string; reason?: string },
  labels: Record<string, string>,
): string {
  if (input.reasonCode && input.reasonCode !== 'OTHER') {
    const label = labels[input.reasonCode];
    if (label) return label;
  }
  return input.reason?.trim() ?? '';
}

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
