import { Link, useParams } from 'react-router-dom';
import { CheckIcon, ReceiptIcon } from '../../components/ui/icons';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface OrderSuccessPageProps {}

export function OrderSuccessPage({}: Readonly<OrderSuccessPageProps>) {
  const { code = '' } = useParams<{ code: string }>();

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        <CheckIcon className="size-7" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Đặt hàng thành công</h1>
      <p className="mt-2 text-ink-muted">
        Cảm ơn bạn. Đơn hàng đang chờ cửa hàng xác nhận, chúng tôi sẽ liên hệ sớm.
      </p>

      <p className="mt-5 rounded-card border border-line bg-surface px-4 py-3">
        <span className="text-sm text-ink-muted">Mã đơn hàng</span>
        <span className="mt-1 block font-mono text-lg font-semibold">{code}</span>
      </p>

      <div className="mt-6 flex justify-center gap-2">
        <Link
          to={`/don-hang/${code}`}
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink"
        >
          <ReceiptIcon className="size-4" />
          Xem chi tiết đơn
        </Link>
        <Link
          to="/san-pham"
          className="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold transition-colors duration-[160ms] hover:bg-sunken"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}
