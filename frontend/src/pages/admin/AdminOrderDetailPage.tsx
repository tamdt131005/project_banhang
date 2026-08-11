import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { OrderSummary } from '../../components/order/OrderSummary';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { ArrowLeftIcon, UserIcon, WalletIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import {
  ORDER_STATUS_LABEL,
  ORDER_TRANSITIONS,
  type OrderStatus,
  formatDateTime,
} from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminOrderDetailPageProps {}

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

export function AdminOrderDetailPage({}: Readonly<AdminOrderDetailPageProps>) {
  const { code = '' } = useParams<{ code: string }>();
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const order = useQuery({
    queryKey: ['admin', 'order', code],
    queryFn: () => adminGateway.orders.detail(code).then((response) => response.order),
    enabled: code !== '',
  });

  const changeStatus = useMutation({
    mutationFn: (status: OrderStatus) => adminGateway.orders.setStatus(order.data!.id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'order', code] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      // Huỷ đơn hoàn lại tồn kho, nên danh sách sản phẩm cũng phải nạp lại.
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      // Huỷ/giao xong đều đổi doanh thu và cảnh báo kho ở trang tổng quan.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      setPendingStatus(null);
    },
    onError: () => {
      // Có thể trạng thái vừa đổi ở phiên khác; nạp lại matrix theo trạng thái mới của server.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'order', code] });
    },
  });

  const changePayment = useMutation({
    mutationFn: (paymentStatus: 'UNPAID' | 'PAID' | 'FAILED') =>
      adminGateway.orders.setPaymentStatus(order.data!.id, paymentStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'order', code] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });

  if (order.isPending) return <Skeleton className="h-80" />;

  if (order.isError) {
    return (
      <div className="space-y-4">
        <Alert>{errorMessage(order.error)}</Alert>
        <Link
          to="/admin/don-hang"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
        >
          <ArrowLeftIcon className="size-4" />
          Về danh sách đơn hàng
        </Link>
      </div>
    );
  }

  const data = order.data;
  // Chỉ hiện những bước hợp lệ, thay vì hiện hết rồi để backend từ chối.
  const nextStates = ORDER_TRANSITIONS[data.status];

  return (
    <div className="space-y-4">
      <Link
        to="/admin/don-hang"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-[160ms] hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách đơn hàng
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold">{data.code}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {data.user.fullName} · {data.user.email}
          </p>
          <p className="text-sm text-ink-muted">Đặt lúc {formatDateTime(data.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/admin/khach-hang/${data.user.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-medium transition-colors duration-[160ms] hover:bg-sunken"
          >
            <UserIcon className="size-4" />
            Hồ sơ khách
          </Link>
          <OrderStatusBadge status={data.status} />
        </div>
      </div>

      {changeStatus.isError ? <Alert>{errorMessage(changeStatus.error)}</Alert> : null}
      {changePayment.isError ? <Alert>{errorMessage(changePayment.error)}</Alert> : null}

      {/* Cùng lịch sử backend ghi nhận mà khách nhìn thấy — không suy đoán mốc giờ ở frontend. */}
      <OrderTimeline status={data.status} statusHistory={data.statusHistory} />

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-1 font-semibold">Cập nhật trạng thái</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Trạng thái đơn chỉ đi tới, không lùi lại được.
          </p>

          {nextStates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {nextStates.map((status) => (
                <Button
                  key={status}
                  variant={status === 'CANCELLED' ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => setPendingStatus(status)}
                >
                  {ORDER_STATUS_LABEL[status]}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Đơn đã {ORDER_STATUS_LABEL[data.status].toLowerCase()} — không còn bước tiếp theo.
            </p>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <WalletIcon className="size-4 text-accent" />
            Tình trạng thanh toán
          </h2>
          <p className="mb-3 text-xs text-ink-muted">
            {data.paymentMethod === 'COD'
              ? 'Đơn COD tự đánh dấu đã thanh toán khi giao xong. Đánh dấu tay khi khách chuyển khoản trước hoặc thu tiền thất bại.'
              : 'Đánh dấu tay theo kết quả đối soát với cổng thanh toán.'}
          </p>

          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Hiện tại:</span>
            <span
              className={`rounded-control px-2 py-0.5 text-xs font-medium ${PAYMENT_CLASS[data.paymentStatus] ?? ''}`}
            >
              {PAYMENT_LABEL[data.paymentStatus] ?? data.paymentStatus}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['PAID', 'UNPAID', 'FAILED'] as const)
              .filter((value) => value !== data.paymentStatus)
              .map((value) => (
                <Button
                  key={value}
                  variant={value === 'FAILED' ? 'danger' : 'secondary'}
                  size="sm"
                  loading={changePayment.isPending && changePayment.variables === value}
                  onClick={() => changePayment.mutate(value)}
                >
                  {PAYMENT_LABEL[value]}
                </Button>
              ))}
          </div>
        </section>
      </div>

      <OrderSummary order={data} />

      <ConfirmDialog
        open={pendingStatus !== null}
        danger={pendingStatus === 'CANCELLED'}
        title={
          pendingStatus
            ? `Chuyển đơn sang "${ORDER_STATUS_LABEL[pendingStatus]}"?`
            : 'Đổi trạng thái?'
        }
        description={
          pendingStatus === 'CANCELLED'
            ? 'Toàn bộ sản phẩm trong đơn sẽ được trả lại kho. Không hoàn tác được.'
            : 'Trạng thái đơn chỉ đi tới, không lùi lại được.'
        }
        confirmLabel="Xác nhận"
        loading={changeStatus.isPending}
        onConfirm={() => {
          if (pendingStatus) changeStatus.mutate(pendingStatus);
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  );
}
