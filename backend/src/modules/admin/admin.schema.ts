import { z } from 'zod';

/**
 * Bộ lọc kho hàng. Tồn kho nằm trên BIẾN THỂ nên trang kho liệt kê biến thể
 * chứ không phải sản phẩm — một chiếc áo hết size M nhưng còn size L là hai
 * tình trạng khác nhau, gộp lại thì không ai xử lý được.
 */
export const inventoryQuerySchema = z.object({
  search: z.string().trim().max(191).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  /** Chỉ hiện biến thể tồn kho thấp (≤ ngưỡng) — việc cần làm gấp nhất. */
  lowOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
  sort: z.enum(['stock-asc', 'stock-desc', 'name']).default('stock-asc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

/** Đặt lại tồn kho cho một biến thể. Trần 100000 để tránh gõ nhầm quá tay. */
export const stockUpdateSchema = z.object({
  stock: z.coerce
    .number()
    .int('Tồn kho phải là số nguyên')
    .min(0, 'Tồn kho không được âm')
    .max(100_000, 'Tồn kho vượt quá giới hạn cho phép'),
  expectedStock: z.coerce
    .number()
    .int('Tồn kho dự kiến phải là số nguyên')
    .min(0, 'Tồn kho dự kiến không được âm')
    .max(100_000, 'Tồn kho dự kiến vượt quá giới hạn cho phép'),
  reason: z
    .string()
    .trim()
    .min(3, 'Vui lòng ghi lý do điều chỉnh tồn kho')
    .max(500, 'Lý do điều chỉnh quá dài'),
});

export const movementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;
