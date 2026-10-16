import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderApi } from '../../api/orders';
import { Button } from '../../components/ui/Button';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { AlertCircleIcon, CheckIcon, ClockIcon, ReceiptIcon, RefreshIcon, WalletIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; MoMo chuyển về kèm tham số giao dịch trên URL. */
export interface MomoResultPageProps {}

export function MomoResultPage({}: Readonly<MomoResultPageProps>) {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const momoOrderId = params.get('orderId') ?? '';
  // Mã đơn đứng trước dấu "_" (xem backend/src/payments/momo.ts).
  const code = momoOrderId.split('_')[0] ?? '';

  // Không tin resultCode trên URL: backend tự tra cứu giao dịch với MoMo rồi mới cập nhật đơn.
  const verify = useQuery({
    queryKey: ['momo-verify', momoOrderId],
    queryFn: () => orderApi.verifyMomo(code, momoOrderId),
    enabled: momoOrderId !== '',
    retry: false,
    refetchOnWindowFocus: false,
  });

  const payMomo = useMutation({
    mutationFn: () => orderApi.payMomo(code),
    onSuccess: ({ paymentUrl }) => window.location.assign(paymentUrl),
  });

  useEffect(() => {
    if (!verify.data) return;
    queryClient.setQueryData(['order', code], verify.data.order);
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [verify.data, code, queryClient]);

  if (momoOrderId === '') {
    return <Alert>Thiếu thông tin giao dịch MoMo. Vui lòng kiểm tra lại đơn trong mục Đơn hàng của tôi.</Alert>;
  }

  if (verify.isPending) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-ink-muted">Đang xác nhận kết quả thanh toán với MoMo…</p>
        <Skeleton className="h-32" />
      </div>
    );
  }

  const orderLink = (
    <Link
      to={`/don-hang/${code}`}
      className="inline-flex h-11 items-center gap-2 rounded-control border border-line px-5 text-sm font-semibold transition-colors duration-[160ms] hover:bg-sunken"
    >
      <ReceiptIcon className="size-4" />
      Xem chi tiết đơn
    </Link>
  );

  if (verify.isError) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <Alert>{errorMessage(verify.error)}</Alert>
        <div className="flex justify-center">{orderLink}</div>
      </div>
    );
  }

  const { order, outcome, message } = verify.data;
  const paid = order.paymentStatus === 'PAID';
  const failed = !paid && outcome === 'FAILED';
  const canRetry =
    failed && (order.status === 'PENDING' || order.status === 'CONFIRMED');

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div
        className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${
          failed ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-accent-soft text-accent'
        }`}
      >
        {paid ? <CheckIcon className="size-7" /> : failed ? <AlertCircleIcon className="size-7" /> : <ClockIcon className="size-7" />}
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {paid ? 'Thanh toán thành công' : failed ? 'Thanh toán chưa thành công' : 'Giao dịch đang được xử lý'}
      </h1>
      <p className="mt-2 text-ink-muted">
        {paid
          ? 'Cảm ơn bạn. Đơn hàng đã được thanh toán qua MoMo và đang chờ cửa hàng xác nhận.'
          : failed
            ? `MoMo báo: ${message || 'giao dịch không thành công'}. Bạn có thể thanh toán lại.`
            : 'MoMo chưa trả kết quả cuối cùng. Vui lòng kiểm tra lại sau ít phút.'}
      </p>

      <p className="mt-5 rounded-card border border-line bg-surface px-4 py-3">
        <span className="text-sm text-ink-muted">Mã đơn hàng</span>
        <span className="mt-1 block font-mono text-lg font-semibold">{order.code}</span>
        <span className="tabular mt-1 block text-sm text-ink-muted">{formatVnd(order.total)}</span>
      </p>

      {payMomo.isError ? (
        <div className="mt-4 text-left">
          <Alert>{errorMessage(payMomo.error)}</Alert>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {canRetry ? (
          <Button loading={payMomo.isPending || payMomo.isSuccess} onClick={() => payMomo.mutate()}>
            <WalletIcon className="size-4" />
            Thanh toán lại
          </Button>
        ) : null}
        {!paid && !failed ? (
          <Button loading={verify.isFetching} onClick={() => void verify.refetch()}>
            <RefreshIcon className="size-4" />
            Kiểm tra lại
          </Button>
        ) : null}
        {orderLink}
        {paid ? (
          <Link
            to="/san-pham"
            className="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold transition-colors duration-[160ms] hover:bg-sunken"
          >
            Tiếp tục mua sắm
          </Link>
        ) : null}
      </div>
    </div>
  );
}
