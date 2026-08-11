import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { addressApi } from '../../api/addresses';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import {
  BagIcon,
  PinIcon,
  PlusIcon,
  ReceiptIcon,
  TrashIcon,
  TruckIcon,
  WalletIcon,
} from '../../components/ui/icons';
import { useCart, useRemoveCartItem, useSetCartQuantity } from '../../hooks/useCart';
import { errorMessage } from '../../lib/errors';
import { formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface CartPageProps {}

export function CartPage({}: Readonly<CartPageProps>) {
  const navigate = useNavigate();
  const cart = useCart();
  const setQuantity = useSetCartQuantity();
  const removeItem = useRemoveCartItem();

  // Nhắc sớm ngay từ giỏ nếu chưa có địa chỉ nào — khỏi vấp ở bước thanh toán.
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((response) => response.addresses),
  });

  const mutationError = setQuantity.error ?? removeItem.error;

  if (cart.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (cart.isError) return <Alert>{errorMessage(cart.error)}</Alert>;

  const data = cart.data;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Giỏ hàng đang trống"
        description="Thêm vài món để bắt đầu đặt hàng."
        icon={<BagIcon className="size-6" />}
        action={
          <Link
            to="/san-pham"
            className="inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-ink"
          >
            Xem sản phẩm
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Giỏ hàng</h1>

      {mutationError ? <Alert>{errorMessage(mutationError)}</Alert> : null}

      {data.hasUnavailableItems ? (
        <Alert tone="info">
          Có sản phẩm đã ngừng bán hoặc không còn đủ hàng. Vui lòng chỉnh lại trước khi đặt.
        </Alert>
      ) : null}

      {addresses.data?.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-line bg-surface p-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <PinIcon className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Bạn chưa có địa chỉ nhận hàng</p>
            <p className="text-sm text-ink-muted">Thêm trước một địa chỉ để bước đặt hàng nhanh gọn hơn.</p>
          </div>
          <Link
            to="/dia-chi"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-accent px-4 text-xs font-semibold text-accent-ink"
          >
            <PlusIcon className="size-3.5" />
            Thêm địa chỉ
          </Link>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-card border border-line bg-surface p-3"
            >
              <Link
                to={`/san-pham/${item.slug}`}
                className="size-20 shrink-0 overflow-hidden rounded-control bg-sunken"
              >
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-sm font-medium">
                  {item.name}
                </Link>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {item.size} · {item.color}
                </p>
                <p className="tabular mt-1 text-sm text-accent">{formatVnd(item.unitPrice)}</p>

                {!item.isAvailable ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {item.stock === 0 ? 'Đã hết hàng' : `Chỉ còn ${item.stock} sản phẩm`}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <QuantityStepper
                    size="sm"
                    value={item.quantity}
                    max={Math.max(1, Math.min(99, item.stock))}
                    label={`số lượng ${item.name}`}
                    onChange={(quantity) => {
                      if (quantity !== item.quantity) {
                        setQuantity.mutate({ itemId: item.id, quantity });
                      }
                    }}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <TrashIcon className="size-3.5" />
                    Xoá
                  </Button>

                  <span className="tabular ml-auto text-sm font-semibold">
                    {formatVnd(item.lineTotal)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-card border border-line bg-surface p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ReceiptIcon className="size-4 text-accent" />
            Tóm tắt đơn
          </h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tạm tính ({data.itemCount} món)</dt>
              <dd className="tabular">{formatVnd(data.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <TruckIcon className="size-4" />
                Phí vận chuyển
              </dt>
              <dd className="tabular">{formatVnd(data.shippingFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="tabular text-accent">{formatVnd(data.total)}</dd>
            </div>
          </dl>

          <Button
            className="mt-4 w-full"
            disabled={data.hasUnavailableItems}
            onClick={() => void navigate('/thanh-toan')}
          >
            Tiến hành đặt hàng
          </Button>

          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <WalletIcon className="size-3.5" />
            Thanh toán khi nhận hàng (COD)
          </p>
        </aside>
      </div>
    </div>
  );
}
