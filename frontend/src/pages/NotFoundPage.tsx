import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '../components/ui/icons';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface NotFoundPageProps {}

export function NotFoundPage({}: Readonly<NotFoundPageProps>) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="mt-3 text-xl font-semibold">Không tìm thấy trang này</h1>
      <p className="mt-2 text-ink-muted">
        Đường dẫn có thể đã thay đổi hoặc sản phẩm không còn được bán.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Về trang chủ
      </Link>
    </div>
  );
}
