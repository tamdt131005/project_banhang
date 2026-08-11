import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { SORT_LABEL, catalogApi, PRODUCT_SORTS } from '../../api/catalog';
import { CategoryFilter } from '../../components/product/CategoryFilter';
import { ProductGrid } from '../../components/product/ProductGrid';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { FilterIcon, SearchIcon, TagIcon, XIcon } from '../../components/ui/icons';
import { Pagination } from '../../components/ui/Pagination';
import { useProductFilters } from '../../hooks/useProductFilters';
import { errorMessage } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface ProductsPageProps {}

export function ProductsPage({}: Readonly<ProductsPageProps>) {
  const { query, update, reset } = useProductFilters();

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories().then((response) => response.categories),
  });

  const products = useQuery({
    queryKey: ['products', query],
    queryFn: () => catalogApi.products(query),
  });

  // Ô giá là state cục bộ vì gõ tới đâu gọi API tới đó thì vừa giật vừa tốn.
  // Chỉ đẩy vào URL khi người dùng bấm Áp dụng.
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    setMinPrice(query.minPrice === undefined ? '' : String(query.minPrice));
    setMaxPrice(query.maxPrice === undefined ? '' : String(query.maxPrice));
  }, [query.minPrice, query.maxPrice]);

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    update({ minPrice: minPrice || undefined, maxPrice: maxPrice || undefined });
  }

  const filterOptions = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => catalogApi.filterOptions(),
    staleTime: 5 * 60_000,
  });

  const hasFilters =
    query.search !== undefined ||
    query.categoryId !== undefined ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.size !== undefined ||
    query.color !== undefined;

  /** Chip lọc theo biến thể — bấm lại chip đang chọn để bỏ lọc. */
  const chipClass = (active: boolean) =>
    `h-8 rounded-control border px-3 text-xs transition-colors duration-[160ms] ${
      active
        ? 'border-accent bg-accent-soft font-semibold text-accent'
        : 'border-line hover:border-accent hover:text-accent'
    }`;

  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <div className="rounded-card border border-line bg-surface p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FilterIcon className="size-3.5 text-accent" />
            Danh mục
          </h2>
          {categories.isPending ? (
            <p className="text-sm text-ink-muted">Đang tải…</p>
          ) : (
            <CategoryFilter
              categories={categories.data ?? []}
              selectedId={query.categoryId}
              onSelect={(categoryId) => update({ categoryId })}
            />
          )}
        </div>

        {filterOptions.data ? (
          <div className="mt-3 space-y-3 rounded-card border border-line bg-surface p-3">
            <div>
              <h2 className="mb-2 text-sm font-semibold">Size</h2>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.data.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => update({ size: query.size === size ? undefined : size })}
                    className={chipClass(query.size === size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold">Màu sắc</h2>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.data.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update({ color: query.color === color ? undefined : color })}
                    className={chipClass(query.color === color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-muted">Chỉ hiện món còn hàng ở lựa chọn đã chọn.</p>
          </div>
        ) : null}

        <form onSubmit={applyPrice} className="mt-3 rounded-card border border-line bg-surface p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <TagIcon className="size-3.5 text-accent" />
            Khoảng giá
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Từ"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              aria-label="Giá thấp nhất"
              className="tabular h-9 w-full rounded-control border border-line bg-sunken px-2 text-xs outline-none focus:border-accent"
            />
            <span className="text-ink-muted">—</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Đến"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              aria-label="Giá cao nhất"
              className="tabular h-9 w-full rounded-control border border-line bg-sunken px-2 text-xs outline-none focus:border-accent"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">
            Áp dụng
          </Button>
        </form>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={reset} className="mt-2 w-full">
            <XIcon className="size-3.5" />
            Xoá tất cả bộ lọc
          </Button>
        ) : null}
      </aside>

      <section className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {query.search ? `Kết quả cho “${query.search}”` : 'Tất cả sản phẩm'}
            </h1>
            {products.data ? (
              <p className="text-sm text-ink-muted">
                Tìm thấy {products.data.pagination.total} sản phẩm
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Sắp xếp</span>
            <select
              value={query.sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
            >
              {PRODUCT_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABEL[sort]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {products.isError ? (
          <Alert>{errorMessage(products.error)}</Alert>
        ) : products.data?.items.length === 0 ? (
          <EmptyState
            title="Không tìm thấy sản phẩm nào"
            description="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác."
            icon={<SearchIcon className="size-6" />}
            action={
              <Button variant="secondary" size="sm" onClick={reset}>
                Xoá bộ lọc
              </Button>
            }
          />
        ) : (
          <>
            <ProductGrid
              products={products.data?.items ?? []}
              loading={products.isPending}
              skeletonCount={12}
            />
            {products.data ? (
              <Pagination
                page={products.data.pagination.page}
                totalPages={products.data.pagination.totalPages}
                onChange={(page) => {
                  update({ page });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
