import { z } from 'zod';

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên danh mục').max(120, 'Tên danh mục quá dài'),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
