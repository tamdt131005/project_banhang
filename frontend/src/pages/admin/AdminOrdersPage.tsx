import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { ReceiptIcon, SearchIcon, XIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { ORDER_STATUS_LABEL, type OrderStatus, formatDateTime, formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminOrdersPageProps {}

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
};

const PAYMENT_CLASS: Record<string, string> = {
  UNPAID: 'bg-sunken text-ink-muted',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function AdminOrdersPage({}: Readonly<AdminOrdersPageProps>) {
  // Bộ lọc nằm trên URL để chia sẻ được đường dẫn "đơn chờ xác nhận hôm nay".
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const status = params.get('status') as OrderStatus | null;
  const paymentStatus = params.get('paymentStatus') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page') ?? 1);

  const [keyword, setKeyword] = useState(search);
  useEffect(() => setKeyword(search), [search]);

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    if (!('page' in next)) merged.delete('page');
    setParams(merged);
  }

  const orders = useQuery({
    queryKey: ['admin', 'orders', { search, status, paymentStatus, from, to, page }],
    queryFn: () =>
      adminGateway.orders.list({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus: paymentStatus as 'UNPAID' | 'PAID' | 'FAILED' } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page,
        limit: 20,
      }),
  });

  const hasFilters = Boolean(search || status || paymentStatus || from || to);

  const chip = (active: boolean) =>
    `shrink-0 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors duration-[160ms] ${
      active ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-sunken'
    }`;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ search: keyword.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Đơn hàng</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tìm theo mã đơn, tên người nhận hoặc email tài khoản.
          </p>
        </div>
        {orders.data ? (
          <p className="text-sm text-ink-muted">
            <span className="tabular font-semibold text-ink">{orders.data.pagination.total}</span>{' '}
            đơn
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={submitSearch} className="relative min-w-56 flex-1">
            <label htmlFor="order-search" className="sr-only">
              Tìm đơn hàng
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="order-search"
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Mã đơn, tên người nhận, email…"
              className="h-9 w-full rounded-control border border-line bg-sunken pr-3 pl-9 text-sm outline-none focus:border-accent"
            />
          </form>

          <label className="flex shrink-0 items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Thanh toán</span>
            <select
              value={paymentStatus}
              onChange={(event) => update({ paymentStatus: event.target.value })}
              className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Tất cả</option>
              {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex shrink-0 items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Từ</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => update({ from: event.target.value })}
              className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="flex shrink-0 items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Đến</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => update({ to: event.target.value })}
              className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => update({ status: undefined })} className={chip(!status)}>
            Tất cả
          </button>
          {STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ status: value })}
              className={chip(status === value)}
            >
              {ORDER_STATUS_LABEL[value]}
            </button>
          ))}

          {hasFilters ? (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams())}
              className="inline-flex shrink-0 items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-[160ms] hover:bg-accent-soft"
            >
              <XIcon className="size-3.5" />
              Xoá bộ lọc
            </button>
          ) : null}
        </div>
      </div>

      {orders.isPending ? (
        <Skeleton className="h-64" />
      ) : orders.isError ? (
        <Alert>{errorMessage(orders.error)}</Alert>
      ) : orders.data.items.length === 0 ? (
        <EmptyState
          title="Không có đơn nào khớp"
          description={hasFilters ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khoá.' : 'Chưa có đơn hàng nào.'}
          icon={<ReceiptIcon className="size-6" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-xs">
            <table className="w-full min-w-[54rem] text-sm">
              <thead className="border-b border-line bg-sunken/60 text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Mã đơn</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Ngày đặt</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Tổng tiền</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Thanh toán</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {orders.data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-sunken/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-accent">
                      <Link to={`/admin/don-hang/${order.code}`} className="hover:underline">
                        {order.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        to={`/admin/khach-hang/${order.user.id}`}
                        className="font-medium text-ink hover:text-accent transition block"
                      >
                        {order.user.fullName}
                      </Link>
                      <span className="block text-xs text-ink-muted truncate max-w-xs">{order.user.email}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap text-ink-muted">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="tabular px-4 py-3.5 text-right font-bold text-ink">
                      {formatVnd(order.total)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_CLASS[order.paymentStatus] ?? 'bg-sunken text-ink-muted'}`}
                      >
                        {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/don-hang/${order.code}`}
                        className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent hover:text-accent shadow-2xs"
                      >
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={orders.data.pagination.page}
            totalPages={orders.data.pagination.totalPages}
            onChange={(next) => update({ page: String(next) })}
          />
        </>
      )}
    </div>
  );
}
