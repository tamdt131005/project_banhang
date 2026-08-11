import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../../api/orders';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { OrderSummary } from '../../components/order/OrderSummary';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { ArrowLeftIcon, XIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface OrderDetailPageProps {}

export function OrderDetailPage({}: Readonly<OrderDetailPageProps>) {
  const { code = '' } = useParams<{ code: string }>();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const order = useQuery({
    queryKey: ['order', code],
    queryFn: () => orderApi.getMine(code).then((response) => response.order),
    enabled: code !== '',
  });

  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(code),
    onSuccess: ({ order: updated }) => {
      queryClient.setQueryData(['order', code], updated);
      // Danh sách đơn và tồn kho sản phẩm đều đổi sau khi huỷ.
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setConfirming(false);
    },
    onError: () => {
      // Huỷ có thể chạy đồng thời với cập nhật admin; luôn làm mới trạng thái thật sau lỗi.
      void queryClient.invalidateQueries({ queryKey: ['order', code] });
    },
  });

  if (order.isPending) return <Skeleton className="h-72" />;

  if (order.isError) {
    return (
      <div className="space-y-4">
        <Alert>{errorMessage(order.error)}</Alert>
        <Link to="/don-hang" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <ArrowLeftIcon className="size-4" />
          Về danh sách đơn hàng
        </Link>
      </div>
    );
  }

  const data = order.data;

  return (
    <div className="space-y-4">
      <Link
        to="/don-hang"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-[160ms] hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Đơn hàng của tôi
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold">{data.code}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Đặt lúc {formatDateTime(data.createdAt)}</p>
        </div>

        <div className="flex items-center gap-3">
          <OrderStatusBadge status={data.status} />
          {/* Khách chỉ tự huỷ được khi shop chưa xác nhận; sau đó backend từ chối. */}
          {data.status === 'PENDING' ? (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              <XIcon className="size-3.5" />
              Huỷ đơn
            </Button>
          ) : null}
        </div>
      </div>

      {cancel.isError ? <Alert>{errorMessage(cancel.error)}</Alert> : null}

      {/* Lịch sử thật từ backend; component chỉ fallback về trạng thái hiện tại với payload cũ. */}
      <OrderTimeline status={data.status} statusHistory={data.statusHistory} />

      <OrderSummary order={data} />

      <ConfirmDialog
        open={confirming}
        danger
        title="Huỷ đơn hàng này?"
        description="Sản phẩm sẽ được trả lại kho. Thao tác không hoàn tác được."
        confirmLabel="Huỷ đơn"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
