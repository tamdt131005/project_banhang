import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { PlusIcon, SearchIcon } from '../../components/ui/icons';
import { Pagination } from '../../components/ui/Pagination';
import { flattenCategories } from '../../lib/category';
import { errorMessage } from '../../lib/errors';
import { formatVnd } from '../../lib/format';
import type { ApiProductSummary } from '../../types/api';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminProductsPageProps {}

export function AdminProductsPage({}: Readonly<AdminProductsPageProps>) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<'newest' | 'name' | 'price-asc' | 'price-desc'>('newest');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<ApiProductSummary | null>(null);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminGateway.categories.list().then((response) => response.categories),
    staleTime: 5 * 60_000,
  });

  const products = useQuery({
    queryKey: ['admin', 'products', { search: applied, categoryId, sort, page }],
    queryFn: () =>
      adminGateway.products.list({
        ...(applied ? { search: applied } : {}),
        ...(categoryId ? { categoryId: Number(categoryId) } : {}),
        sort,
        page,
        limit: 20,
      }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    // Cửa hàng cũng phải thấy thay đổi ngay, không chờ cache hết hạn.
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const toggleActive = useMutation({
    mutationFn: (input: { id: number; isActive: boolean }) =>
      adminGateway.products.update(input.id, { isActive: input.isActive }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminGateway.products.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setApplied(search.trim());
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Sản phẩm</h1>
        <Link
          to="/admin/san-pham/moi"
          className="inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-xs font-semibold text-accent-ink"
        >
          <PlusIcon className="size-3.5" />
          Thêm sản phẩm
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-56 flex-1">
          <label htmlFor="product-search" className="sr-only">
            Tìm sản phẩm
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên sản phẩm…"
            className="h-9 w-full rounded-control border border-line bg-sunken pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </form>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-ink-muted">Danh mục</span>
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Tất cả</option>
            {flattenCategories(categories.data ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-ink-muted">Sắp xếp</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(1);
            }}
            className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
          >
            <option value="newest">Mới nhất</option>
            <option value="name">Tên A-Z</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
          </select>
        </label>
      </div>

      {toggleActive.isError ? <Alert>{errorMessage(toggleActive.error)}</Alert> : null}
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}

      {products.isPending ? (
        <Skeleton className="h-64" />
      ) : products.isError ? (
        <Alert>{errorMessage(products.error)}</Alert>
      ) : products.data.items.length === 0 ? (
        <EmptyState title="Không có sản phẩm nào" description="Thử từ khoá khác hoặc thêm mới." />
      ) : (
        <>
          {/* Bảng cuộn ngang trong hộp riêng — trang không bao giờ tràn ngang. */}
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-line bg-sunken text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Sản phẩm</th>
                  <th className="px-3 py-2 font-semibold">Danh mục</th>
                  <th className="px-3 py-2 text-right font-semibold">Giá</th>
                  <th className="px-3 py-2 text-right font-semibold">Tồn</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {products.data.items.map((product) => (
                  <tr key={product.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-10 shrink-0 overflow-hidden rounded bg-sunken">
                          {product.images[0] ? (
                            <img
                              src={product.images[0].thumbUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="line-clamp-2 max-w-[16rem]">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{product.category.name}</td>
                    <td className="tabular px-3 py-2 text-right">{formatVnd(product.price)}</td>
                    <td className="tabular px-3 py-2 text-right">{product.stock}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-sunken text-ink-muted'
                        }`}
                      >
                        {product.isActive ? 'Đang bán' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/san-pham/${product.id}`}
                          className="rounded-control px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                        >
                          Sửa
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            toggleActive.mutate({ id: product.id, isActive: !product.isActive })
                          }
                          className="rounded-control px-2 py-1 text-xs hover:bg-sunken"
                        >
                          {product.isActive ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(product)}
                          className="rounded-control px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={products.data.pagination.page}
            totalPages={products.data.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Xoá sản phẩm này?"
        description={
          deleting
            ? `"${deleting.name}" sẽ bị xoá cùng toàn bộ ảnh. Đơn hàng cũ vẫn giữ nguyên tên và giá đã mua.`
            : undefined
        }
        confirmLabel="Xoá"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
