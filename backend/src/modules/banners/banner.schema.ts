import { z } from 'zod';

export const BANNER_PLACEMENTS = ['HOME_HERO'] as const;

const placementSchema = z.enum(BANNER_PLACEMENTS);

const linkUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .max(500, 'Liên kết quá dài')
    .refine(
      (value) =>
        !/[\\\u0000-\u001f\u007f]/.test(value) &&
        (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)),
      'Liên kết phải bắt đầu bằng /, http:// hoặc https://',
    )
    .nullable()
    .optional(),
);

const bannerFields = {
  name: z.string().trim().min(1, 'Vui lòng nhập tên banner').max(120, 'Tên banner quá dài'),
  altText: z.string().trim().min(1, 'Vui lòng nhập mô tả ảnh').max(255, 'Mô tả ảnh quá dài'),
  linkUrl: linkUrlSchema,
  placement: placementSchema,
  sortOrder: z.coerce.number().int().min(0, 'Thứ tự không được âm'),
  isActive: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]),
};

export const bannerQuerySchema = z.object({ placement: placementSchema.default('HOME_HERO') });
export const bannerCreateSchema = z.object({
  ...bannerFields,
  placement: bannerFields.placement.default('HOME_HERO'),
  sortOrder: bannerFields.sortOrder.default(0),
  isActive: bannerFields.isActive.default(true),
});
export const bannerUpdateSchema = z.object(bannerFields).partial();
export const bannerActiveSchema = z.object({ isActive: z.boolean() });

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
