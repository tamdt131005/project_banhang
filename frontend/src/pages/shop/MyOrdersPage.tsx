import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orders';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { ChevronRightIcon, ReceiptIcon } from '../../components/ui/icons';
import { Pagination } from '../../components/ui/Pagination';
import { errorMessage } from '../../lib/errors';
import { ORDER_STATUS_LABEL, type OrderStatus, formatDateTime, formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface MyOrdersPageProps {}

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export function MyOrdersPage({}: Readonly<MyOrdersPageProps>) {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const orders = useQuery({
    queryKey: ['orders', { status, page }],
    queryFn: () => orderApi.listMine({ ...(status ? { status } : {}), page, limit: 10 }),
  });

  const chip = (active: boolean) =>
    `shrink-0 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors duration-[160ms] ${
      active ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-sunken'
    }`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Đơn hàng của tôi</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setStatus(undefined);
            setPage(1);
          }}
          className={chip(status === undefined)}
        >
          Tất cả
        </button>
        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={chip(status === value)}
          >
            {ORDER_STATUS_LABEL[value]}
          </button>
        ))}
      </div>

      {orders.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : orders.isError ? (
        <Alert>{errorMessage(orders.error)}</Alert>
      ) : orders.data.items.length === 0 ? (
        <EmptyState
          title="Chưa có đơn hàng nào"
          description={
            status ? 'Không có đơn nào ở trạng thái này.' : 'Đặt đơn đầu tiên để theo dõi ở đây.'
          }
          icon={<ReceiptIcon className="size-6" />}
          action={
            <Link
              to="/san-pham"
              className="inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink"
            >
              Xem sản phẩm
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {orders.data.items.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/don-hang/${order.code}`}
                  className="block rounded-card border border-line bg-surface p-4 transition-[transform,box-shadow] duration-[160ms] ease-snap hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgb(0_0_0/0.08)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                      <ReceiptIcon className="size-4 text-ink-muted" />
                      {order.code}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">{formatDateTime(order.createdAt)}</p>

                  <p className="mt-2 line-clamp-1 text-sm text-ink-muted">
                    {order.items.map((item) => item.productName).join(', ')}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                    <p className="tabular text-sm">
                      <span className="text-ink-muted">{order.items.length} sản phẩm · </span>
                      <span className="font-semibold text-accent">{formatVnd(order.total)}</span>
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
                      Xem chi tiết
                      <ChevronRightIcon className="size-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={orders.data.pagination.page}
            totalPages={orders.data.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
