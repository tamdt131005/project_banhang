import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRODUCT_SORTS, type ProductQuery, type ProductSort } from '../api/catalog';

const PAGE_SIZE = 24;

function readNumber(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readSort(params: URLSearchParams): ProductSort {
  const raw = params.get('sort');
  return PRODUCT_SORTS.includes(raw as ProductSort) ? (raw as ProductSort) : 'newest';
}

/**
 * Bộ lọc sống trong URL chứ không trong state của component.
 *
 * Nhờ vậy người dùng chia sẻ được đường dẫn kèm bộ lọc, bấm Quay lại thì về
 * đúng bộ lọc trước đó, và tải lại trang không mất lựa chọn.
 */
export function useProductFilters() {
  const [params, setParams] = useSearchParams();

  const query = useMemo<ProductQuery>(() => {
    const search = params.get('search')?.trim();
    const size = params.get('size')?.trim();
    const color = params.get('color')?.trim();
    return {
      ...(search ? { search } : {}),
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      ...(readNumber(params, 'categoryId') === undefined
        ? {}
        : { categoryId: readNumber(params, 'categoryId') }),
      ...(readNumber(params, 'minPrice') === undefined
        ? {}
        : { minPrice: readNumber(params, 'minPrice') }),
      ...(readNumber(params, 'maxPrice') === undefined
        ? {}
        : { maxPrice: readNumber(params, 'maxPrice') }),
      sort: readSort(params),
      page: readNumber(params, 'page') ?? 1,
      limit: PAGE_SIZE,
    };
  }, [params]);

  const update = useCallback(
    (
      patch: Partial<
        Record<
          'search' | 'categoryId' | 'minPrice' | 'maxPrice' | 'size' | 'color' | 'sort' | 'page',
          string | number | undefined
        >
      >,
    ) => {
      const next = new URLSearchParams(params);

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      // Đổi bất kỳ điều kiện lọc nào cũng phải về trang 1: giữ nguyên trang 5
      // khi kết quả mới chỉ có 2 trang sẽ ra danh sách trống khó hiểu.
      if (!('page' in patch)) {
        next.delete('page');
      }

      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);

  return { query, update, reset };
}
