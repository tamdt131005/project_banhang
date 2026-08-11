import { z } from 'zod';

/** Trần 99 mỗi dòng: đơn bán lẻ không có nhu cầu lớn hơn, mà lại chặn được người nghịch. */
const quantitySchema = z.coerce
  .number()
  .int('Số lượng phải là số nguyên')
  .positive('Số lượng phải lớn hơn 0')
  .max(99, 'Mỗi sản phẩm chỉ mua tối đa 99 cái một lần');

/**
 * Giỏ hàng thao tác theo BIẾN THỂ (size × màu), không theo sản phẩm:
 * cùng chiếc áo nhưng size M đen và L trắng là hai dòng giỏ riêng.
 */
export const cartAddSchema = z.object({
  variantId: z.coerce.number().int().positive('Biến thể sản phẩm không hợp lệ'),
  quantity: quantitySchema.default(1),
});

export const cartUpdateSchema = z.object({
  quantity: quantitySchema,
});

export type CartAddInput = z.infer<typeof cartAddSchema>;
export type CartUpdateInput = z.infer<typeof cartUpdateSchema>;
