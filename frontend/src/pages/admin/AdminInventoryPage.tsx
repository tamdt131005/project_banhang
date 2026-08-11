import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, type InventoryItem, adminGateway } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import {
  BoxIcon,
  CheckIcon,
  ClockIcon,
  PencilIcon,
  SearchIcon,
  XIcon,
} from '../../components/ui/icons';
import { flattenCategories } from '../../lib/category';
import { errorMessage } from '../../lib/errors';
import { INVENTORY_MOVEMENT_LABEL, formatDateTime, formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminInventoryPageProps {}

const SORTS = [
  { value: 'stock-asc', label: 'Tồn ít nhất trước' },
  { value: 'stock-desc', label: 'Tồn nhiều nhất trước' },
  { value: 'name', label: 'Tên sản phẩm A-Z' },
] as const;

function MovementHistory({ variantId }: Readonly<{ variantId: number }>) {
  const [page, setPage] = useState(1);
  const movements = useQuery({
    queryKey: ['admin', 'inventory', variantId, 'movements', page],
    queryFn: () => adminGateway.inventory.movements(variantId, page, 10),
  });

  if (movements.isPending) return <Skeleton className="h-24" />;
  if (movements.isError) return <Alert>{errorMessage(movements.error)}</Alert>;

  if (movements.data.items.length === 0) {
    return <p className="text-sm text-ink-muted">Chưa có biến động kho được ghi nhận.</p>;
  }

  return (
    <div className="space-y-3">
      <ol className="divide-y divide-line rounded-control border border-line bg-surface">
        {movements.data.items.map((movement) => (
          <li
            key={movement.id}
            className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
          >
            <div>
              <p className="font-medium">{INVENTORY_MOVEMENT_LABEL[movement.type]}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {movement.beforeStock === null ? 'Không có số dư trước' : `Từ ${movement.beforeStock}`}
                {' → '}
                {movement.afterStock}
                {movement.delta === null
                  ? ''
                  : ` · ${movement.delta > 0 ? '+' : ''}${movement.delta}`}
              </p>
              {movement.reason ? <p className="mt-1 text-xs">Lý do: {movement.reason}</p> : null}
            </div>
            <div className="text-right text-xs text-ink-muted">
              <p>{formatDateTime(movement.createdAt)}</p>
              <p>
                {movement.actorType === 'ADMIN'
                  ? 'Nhân viên'
                  : movement.actorType === 'CUSTOMER'
                    ? 'Khách hàng'
                    : 'Hệ thống'}
                {movement.orderId === null ? '' : ` · đơn #${movement.orderId}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Pagination
        page={movements.data.pagination.page}
        totalPages={movements.data.pagination.totalPages}
        onChange={setPage}
      />
    </div>
  );
}

/** Một dòng kho: điều chỉnh có lý do và xem lịch sử tại đúng biến thể. */
function InventoryRow({
  item,
  threshold,
  onSave,
  saving,
}: Readonly<{
  item: InventoryItem;
  threshold: number;
  onSave: (stock: number, reason: string) => void;
  saving: boolean;
}>) {
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [value, setValue] = useState(String(item.stock));
  const [reason, setReason] = useState('');

  // Người khác vừa sửa hoặc vừa lưu xong: đồng bộ lại ô nhập theo server.
  useEffect(() => {
    setValue(String(item.stock));
    setReason('');
    setEditing(false);
  }, [item.stock]);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0;
  const changed = valid && parsed !== item.stock;
  const validReason = reason.trim().length > 0;

  const level =
    item.stock === 0
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : item.stock <= threshold
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="p-3">
          <div className="flex items-center gap-3">
            <div className="size-11 shrink-0 overflow-hidden rounded-control bg-sunken">
              {item.product.thumbUrl ? (
                <img
                  src={item.product.thumbUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <Link
                to={`/admin/san-pham/${item.product.id}`}
                className="line-clamp-1 text-sm font-medium hover:text-accent"
              >
                {item.product.name}
              </Link>
              <p className="text-xs text-ink-muted">
                {item.product.category.name}
                {item.product.isActive ? '' : ' · đang ẩn'}
              </p>
            </div>
          </div>
        </td>

        <td className="p-3 text-sm whitespace-nowrap">
          {item.size} · {item.color}
        </td>

        <td className="tabular p-3 text-right text-sm whitespace-nowrap">
          {formatVnd(item.product.price)}
        </td>

        <td className="p-3">
          {editing ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-end gap-1.5">
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  aria-label={`Tồn kho ${item.product.name} ${item.size} ${item.color}`}
                  className="tabular h-9 w-20 rounded-control border border-line bg-sunken px-2 text-right text-sm outline-none focus:border-accent"
                />
                <Button
                  size="sm"
                  disabled={!changed || !validReason}
                  loading={saving}
                  onClick={() => onSave(parsed, reason.trim())}
                  aria-label="Lưu điều chỉnh tồn kho"
                >
                  <CheckIcon className="size-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setValue(String(item.stock));
                    setReason('');
                    setEditing(false);
                  }}
                  aria-label="Huỷ sửa tồn kho"
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
              <input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Lý do điều chỉnh (bắt buộc)"
                aria-label={`Lý do điều chỉnh ${item.product.name} ${item.size} ${item.color}`}
                className="h-8 w-full min-w-52 rounded-control border border-line bg-sunken px-2 text-xs outline-none focus:border-accent"
              />
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <span className={`tabular rounded-control px-2 py-1 text-sm font-bold ${level}`}>
                {item.stock}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon className="size-3" />
                Sửa
              </Button>
            </div>
          )}
        </td>

        <td className="p-3 text-right text-xs whitespace-nowrap text-ink-muted">
          <p>{formatDateTime(item.updatedAt)}</p>
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
            className="mt-1 inline-flex items-center gap-1 font-medium text-accent"
          >
            <ClockIcon className="size-3" />
            {historyOpen ? 'Ẩn lịch sử' : 'Lịch sử'}
          </button>
        </td>
      </tr>
      {historyOpen ? (
        <tr className="border-b border-line bg-sunken/50">
          <td colSpan={5} className="p-3">
            <MovementHistory variantId={item.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminInventoryPage({}: Readonly<AdminInventoryPageProps>) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const lowOnly = params.get('lowOnly') === 'true';
  const search = params.get('search') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const sort = (params.get('sort') ?? 'stock-asc') as (typeof SORTS)[number]['value'];
  const page = Number(params.get('page') ?? 1);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminGateway.categories.list().then((response) => response.categories),
    staleTime: 5 * 60_000,
  });

  // Ô tìm là state cục bộ: gõ tới đâu gọi API tới đó vừa giật vừa tốn.
  const [keyword, setKeyword] = useState(search);
  useEffect(() => setKeyword(search), [search]);

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    // Đổi bộ lọc thì luôn về trang 1, nếu không sẽ rơi vào trang trống.
    if (!('page' in next)) merged.delete('page');
    setParams(merged);
  }

  const inventory = useQuery({
    queryKey: ['admin', 'inventory', { search, categoryId, lowOnly, sort, page }],
    queryFn: () =>
      adminGateway.inventory.list({
        ...(search ? { search } : {}),
        ...(categoryId ? { categoryId: Number(categoryId) } : {}),
        ...(lowOnly ? { lowOnly: true } : {}),
        sort,
        page,
        limit: 20,
      }),
  });

  const setStock = useMutation({
    mutationFn: (input: { id: number; stock: number; expectedStock: number; reason: string }) =>
      adminGateway.inventory.setStock(input.id, {
        stock: input.stock,
        expectedStock: input.expectedStock,
        reason: input.reason,
      }),
    onSuccess: (_response, input) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'inventory', input.id, 'movements'],
      });
      // Tồn kho đổi thì thẻ cảnh báo ở tổng quan và lưới cửa hàng đều cũ.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'STOCK_CHANGED') {
        // CAS thất bại: tải lại số dư thật trước khi nhân viên quyết định điều chỉnh lại.
        void queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      }
    },
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ search: keyword.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kho hàng</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tồn kho nằm trên từng biến thể size × màu — sửa trực tiếp tại đây khi nhập hàng.
          </p>
        </div>
        {inventory.data ? (
          <p className="text-sm text-ink-muted">
            <span className="tabular font-semibold text-ink">{inventory.data.pagination.total}</span>{' '}
            biến thể
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-56 flex-1">
          <label htmlFor="inventory-search" className="sr-only">
            Tìm theo tên sản phẩm
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="inventory-search"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên sản phẩm…"
            className="h-9 w-full rounded-control border border-line bg-sunken pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </form>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-ink-muted">Danh mục</span>
          <select
            value={categoryId}
            onChange={(event) => update({ categoryId: event.target.value })}
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

        <button
          type="button"
          onClick={() => update({ lowOnly: lowOnly ? undefined : 'true' })}
          aria-pressed={lowOnly}
          className={`h-9 shrink-0 rounded-control border px-3 text-xs font-medium transition-colors duration-[160ms] ${
            lowOnly ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-sunken'
          }`}
        >
          Chỉ hàng sắp hết
        </button>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-ink-muted">Sắp xếp</span>
          <select
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {setStock.isError ? (
        <Alert>
          {setStock.error instanceof ApiError && setStock.error.code === 'STOCK_CHANGED'
            ? 'Tồn kho đã thay đổi ở phiên khác. Dữ liệu mới đang được tải lại; hãy kiểm tra rồi điều chỉnh lại.'
            : errorMessage(setStock.error)}
        </Alert>
      ) : null}

      {inventory.isPending ? (
        <Skeleton className="h-72" />
      ) : inventory.isError ? (
        <Alert>{errorMessage(inventory.error)}</Alert>
      ) : inventory.data.items.length === 0 ? (
        <EmptyState
          title="Không có biến thể nào"
          description={
            lowOnly
              ? 'Không có mặt hàng nào sắp hết — kho đang ổn.'
              : 'Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác.'
          }
          icon={<BoxIcon className="size-6" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[44rem] text-left">
              <thead className="border-b border-line bg-sunken text-xs text-ink-muted">
                <tr>
                  <th className="p-3 font-medium">Sản phẩm</th>
                  <th className="p-3 font-medium">Biến thể</th>
                  <th className="p-3 text-right font-medium">Giá</th>
                  <th className="p-3 text-right font-medium">Tồn kho</th>
                  <th className="p-3 text-right font-medium">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {inventory.data.items.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    threshold={inventory.data.threshold}
                    saving={setStock.isPending && setStock.variables?.id === item.id}
                    onSave={(stock, reason) =>
                      setStock.mutate({ id: item.id, stock, expectedStock: item.stock, reason })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={inventory.data.pagination.page}
            totalPages={inventory.data.pagination.totalPages}
            onChange={(next) => update({ page: String(next) })}
          />
        </>
      )}
    </div>
  );
}
