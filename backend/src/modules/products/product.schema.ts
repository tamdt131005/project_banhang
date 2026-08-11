import { z } from 'zod';

export const PRODUCT_SORTS = ['newest', 'price-asc', 'price-desc', 'name'] as const;

export const productQuerySchema = z
  .object({
    search: z.string().trim().max(191).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().nonnegative().optional(),
    // Lọc nhanh kiểu Coolmate: chỉ trả sản phẩm CÒN HÀNG ở size/màu đã chọn.
    size: z.string().trim().min(1).max(20).optional(),
    color: z.string().trim().min(1).max(50).optional(),
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    page: z.coerce.number().int().positive().default(1),
    // Trần 60 để một request không kéo về cả kho hàng.
    limit: z.coerce.number().int().positive().max(60).default(24),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: 'Giá thấp nhất không được lớn hơn giá cao nhất', path: ['minPrice'] },
  );

const variantIdentityFields = {
  size: z.string().trim().min(1, 'Vui lòng nhập size').max(20, 'Size quá dài'),
  color: z.string().trim().min(1, 'Vui lòng nhập màu').max(50, 'Tên màu quá dài'),
};

const initialStockSchema = z.coerce
  .number()
  .int('Tồn kho phải là số nguyên')
  .min(0, 'Tồn kho không được âm')
  .max(100_000, 'Tồn kho vượt quá giới hạn cho phép');

/** New variants declare initial stock once; later stock changes use the inventory endpoint. */
export const productCreateVariantSchema = z
  .object({
    ...variantIdentityFields,
    initialStock: initialStockSchema,
  })
  .strict();

const existingVariantUpdateSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    ...variantIdentityFields,
  })
  .strict();

const newVariantUpdateSchema = productCreateVariantSchema;
export const productUpdateVariantSchema = z.union([
  existingVariantUpdateSchema,
  newVariantUpdateSchema,
]);

function variantList<T extends z.ZodType<{ size: string; color: string }>>(itemSchema: T) {
  return z
    .array(itemSchema)
    .min(1, 'Sản phẩm cần ít nhất một biến thể size/màu')
    .max(60, 'Quá nhiều biến thể')
    .refine(
      (variants) =>
        new Set(variants.map((variant) => `${variant.size}\u0000${variant.color}`)).size ===
        variants.length,
      { message: 'Có hai biến thể trùng cả size lẫn màu' },
    );
}

const productUpdateVariantListSchema = variantList(productUpdateVariantSchema).superRefine(
  (variants, context) => {
    const seenIds = new Set<number>();
    variants.forEach((variant, index) => {
      if (!('id' in variant)) return;
      if (seenIds.has(variant.id)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: 'Mỗi id biến thể hiện có chỉ được xuất hiện một lần',
        });
      }
      seenIds.add(variant.id);
    });
  },
);

const productFields = {
  name: z.string().trim().min(2, 'Tên sản phẩm quá ngắn').max(255, 'Tên sản phẩm quá dài'),
  description: z.string().trim().min(1, 'Vui lòng nhập mô tả').max(5000, 'Mô tả quá dài'),
  // Cột price là INT nên chặn ở 2 tỷ, dưới trần 2_147_483_647 của MySQL.
  price: z.coerce
    .number()
    .int('Giá phải là số nguyên (đồng)')
    .positive('Giá phải lớn hơn 0')
    .max(2_000_000_000, 'Giá vượt quá giới hạn cho phép'),
  categoryId: z.coerce.number().int().positive('Vui lòng chọn danh mục'),
  isActive: z.boolean().optional(),
};

export const productCreateSchema = z.object({
  ...productFields,
  variants: variantList(productCreateVariantSchema),
});

/**
 * `variants` trong update là NGỮ NGHĨA THAY THẾ: danh sách gửi lên trở thành
 * bộ biến thể mới của sản phẩm — biến thể trùng size+màu giữ nguyên id (và
 * các dòng giỏ hàng đang trỏ vào), biến thể vắng mặt bị xoá.
 */
export const productUpdateSchema = z.object({
  name: productFields.name.optional(),
  description: productFields.description.optional(),
  price: productFields.price.optional(),
  categoryId: productFields.categoryId.optional(),
  isActive: productFields.isActive,
  variants: productUpdateVariantListSchema.optional(),
});

/** Thứ tự ảnh mới — phần tử đầu tiên trở thành ảnh bìa. */
export const imageOrderSchema = z.object({
  imageIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Cần ít nhất một ảnh')
    .max(20, 'Quá nhiều ảnh'),
});

export type ImageOrderInput = z.infer<typeof imageOrderSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductCreateVariantInput = z.infer<typeof productCreateVariantSchema>;
export type ProductUpdateVariantInput = z.infer<typeof productUpdateVariantSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
