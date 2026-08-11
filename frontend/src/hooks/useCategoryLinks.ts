import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/catalog';
import type { ApiCategory } from '../types/api';

/**
 * Link điều hướng theo danh mục cho header và footer.
 *
 * Nav cần đường dẫn dạng /san-pham?categoryId=N nhưng id chỉ biết lúc chạy,
 * nên tra từ cây danh mục (đã cache chung queryKey với trang chủ — không tốn
 * thêm request). Chưa tải xong thì rơi về /san-pham, bấm vẫn có nghĩa.
 */
export function useCategoryLinks() {
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories().then((response) => response.categories),
    staleTime: 5 * 60_000,
  });

  function linkFor(slug: string): string {
    const all = data ?? [];
    const found =
      all.find((category) => category.slug === slug) ??
      all.flatMap((category) => category.children).find((category) => category.slug === slug);
    return found ? `/san-pham?categoryId=${found.id}` : '/san-pham';
  }

  /** Danh mục con của một danh mục gốc — cho menu thả xuống của header. */
  function childrenFor(slug: string): ApiCategory[] {
    return (data ?? []).find((category) => category.slug === slug)?.children ?? [];
  }

  return { linkFor, childrenFor };
}
