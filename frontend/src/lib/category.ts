import type { ApiCategory } from '../types/api';

export interface FlatCategory {
  id: number;
  /** Tên đã thụt lề theo cấp, dùng trực tiếp làm nhãn <option>. */
  label: string;
  depth: number;
}

/**
 * Trải cây danh mục thành danh sách phẳng cho thẻ <select>.
 * `<option>` không hiển thị được cấu trúc lồng nhau, nên phải mô phỏng bằng
 * dấu thụt lề.
 */
export function flattenCategories(categories: ApiCategory[], depth = 0): FlatCategory[] {
  return categories.flatMap((category) => [
    {
      id: category.id,
      label: `${'— '.repeat(depth)}${category.name}`,
      depth,
    },
    ...flattenCategories(category.children, depth + 1),
  ]);
}
