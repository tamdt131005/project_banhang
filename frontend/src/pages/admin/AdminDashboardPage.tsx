import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { RevenueChart } from '../../components/admin/RevenueChart';
import { StatCard } from '../../components/admin/StatCard';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import {
  AlertCircleIcon,
  BoxIcon,
  ChevronRightIcon,
  ReceiptIcon,
  UserIcon,
  WalletIcon,
} from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL, formatDateTime, formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminDashboardPageProps {}

/** Rút gọn tiền cho ô số liệu: 1.250.000 ₫ → 1,25 tr ₫. */
function compactVnd(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 2)} tr ₫`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K ₫`;
  return formatVnd(amount);
}

export function AdminDashboardPage({}: Readonly<AdminDashboardPageProps>) {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminGateway.dashboard.stats(),
    // Số liệu đổi theo từng đơn mới, nhưng không cần realtime — 1 phút là đủ.
    staleTime: 60_000,
  });

  if (stats.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (stats.isError) return <Alert>{errorMessage(stats.error)}</Alert>;

  const data = stats.data;

  // % thay đổi thật giữa hai tuần. Tuần trước bằng 0 thì không có mẫu số —
  // nói thẳng "chưa có gì để so" thay vì hiện một con số vô nghĩa.
  const { last7Days, previous7Days } = data.revenue;
  const delta =
    previous7Days === 0 ? null : Math.round(((last7Days - previous7Days) / previous7Days) * 100);

  const statusRows = [
    { key: 'PENDING', count: data.orders.pending },
    { key: 'CONFIRMED', count: data.orders.confirmed },
    { key: 'SHIPPING', count: data.orders.shipping },
    { key: 'DELIVERED', count: data.orders.delivered },
    { key: 'CANCELLED', count: data.orders.cancelled },
  ] as const;

  const needsAttention = data.orders.pending + data.stock.low + data.stock.out;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tổng quan</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {needsAttention > 0
            ? `Có ${data.orders.pending} đơn chờ xác nhận và ${data.stock.low + data.stock.out} biến thể cần nhập thêm hàng.`
            : 'Chưa có việc nào cần xử lý gấp.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh thu đã giao"
          value={compactVnd(data.revenue.delivered)}
          hint={`${data.orders.delivered} đơn đã giao thành công`}
          icon={<WalletIcon />}
          tone="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          to="/admin/don-hang"
        />
        <StatCard
          label="Đơn đang xử lý"
          value={String(data.orders.pending + data.orders.confirmed + data.orders.shipping)}
          hint={`Giá trị ${compactVnd(data.revenue.inProgress)} chưa giao xong`}
          icon={<ReceiptIcon />}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          to="/admin/don-hang"
        />
        <StatCard
          label="Sản phẩm đang bán"
          value={String(data.catalog.activeProducts)}
          hint={`${data.catalog.products} sản phẩm · ${data.catalog.variants} biến thể`}
          icon={<BoxIcon />}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          to="/admin/san-pham"
        />
        <StatCard
          label="Cảnh báo kho"
          value={String(data.stock.low + data.stock.out)}
          hint={`${data.stock.out} hết hàng · ${data.stock.low} còn ≤ ${data.stock.threshold}`}
          icon={<AlertCircleIcon />}
          tone={
            data.stock.low + data.stock.out > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              : 'bg-sunken text-ink-muted'
          }
          to="/admin/kho?lowOnly=true"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold">Doanh thu 7 ngày</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Tính theo ngày đặt, không gồm đơn đã huỷ.
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-lg font-bold">{formatVnd(last7Days)}</p>
              <p className="text-xs text-ink-muted">
                {delta === null
                  ? '7 ngày trước đó chưa có đơn'
                  : `${delta >= 0 ? '+' : ''}${delta}% so với 7 ngày trước`}
              </p>
            </div>
          </div>

          <RevenueChart series={data.series} />
        </section>

        <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Đơn theo trạng thái</h2>

          {data.orders.total === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có đơn hàng nào.</p>
          ) : (
            <ul className="space-y-2.5">
              {statusRows.map((row) => {
                const percent = Math.round((row.count / data.orders.total) * 100);
                return (
                  <li key={row.key}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink-muted">{ORDER_STATUS_LABEL[row.key]}</span>
                      <span className="tabular font-semibold">{row.count}</span>
                    </div>
                    {/* Thanh tỉ lệ dùng đúng cặp màu badge trạng thái. */}
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-control bg-sunken">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full ${ORDER_STATUS_CLASS[row.key].split(' ')[0]}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 border-t border-line pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <UserIcon className="size-4" />
                Khách hàng
              </span>
              <span className="tabular font-semibold">{data.customers.total}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {data.customers.newLast7Days} người mới trong 7 ngày
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Đơn mới nhất</h2>
            <Link
              to="/admin/don-hang"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent"
            >
              Xem tất cả
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">Chưa có đơn hàng nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/admin/don-hang/${order.code}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-[160ms] hover:bg-sunken sm:px-5"
                  >
                    <span className="font-mono text-sm font-semibold">{order.code}</span>
                    <OrderStatusBadge status={order.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                      {order.user.fullName}
                    </span>
                    <span className="text-xs text-ink-muted">{formatDateTime(order.createdAt)}</span>
                    <span className="tabular text-sm font-semibold text-accent">
                      {formatVnd(order.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 font-semibold sm:px-5">
            Bán chạy nhất
          </h2>

          {data.topProducts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Chưa bán được sản phẩm nào.
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {data.topProducts.map((item, index) => (
                <li
                  key={`${item.productId ?? 'da-xoa'}-${index}`}
                  className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
                >
                  <span className="tabular grid size-6 shrink-0 place-items-center rounded-control bg-sunken text-xs font-bold text-ink-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Sản phẩm đã xoá vẫn còn tên trong snapshot đơn hàng,
                        nhưng không còn trang nào để mở. */}
                    {item.productId === null ? (
                      <p className="line-clamp-1 text-sm">{item.name}</p>
                    ) : (
                      <Link
                        to={`/admin/san-pham/${item.productId}`}
                        className="line-clamp-1 text-sm font-medium hover:text-accent"
                      >
                        {item.name}
                      </Link>
                    )}
                    <p className="tabular text-xs text-ink-muted">
                      {item.quantity} món · {formatVnd(item.revenue)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Sắp hết hàng</h2>
            <Link
              to="/admin/kho?lowOnly=true"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent"
            >
              Vào kho
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>

          {data.lowStockVariants.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Mọi biến thể đều còn trên {data.stock.threshold} sản phẩm.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.lowStockVariants.map((variant) => (
                <li key={variant.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="size-10 shrink-0 overflow-hidden rounded-control bg-sunken">
                    {variant.thumbUrl ? (
                      <img
                        src={variant.thumbUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/admin/san-pham/${variant.productId}`}
                      className="line-clamp-1 text-sm font-medium hover:text-accent"
                    >
                      {variant.productName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {variant.size} · {variant.color}
                    </p>
                  </div>

                  <span
                    className={`tabular shrink-0 rounded-control px-2 py-0.5 text-xs font-bold ${
                      variant.stock === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {variant.stock === 0 ? 'Hết' : `Còn ${variant.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
