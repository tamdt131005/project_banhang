import { formatVnd } from '../../lib/format';
import type { ApiOrder } from '../../types/api';
import { BagIcon, PinIcon, TruckIcon, WalletIcon } from '../ui/icons';

export interface OrderSummaryProps {
  order: ApiOrder;
}

/** Dùng chung cho trang chi tiết đơn của khách và của quản trị viên. */
export function OrderSummary({ order }: Readonly<OrderSummaryProps>) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section className="rounded-card border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-semibold">
          <BagIcon className="size-4 text-accent" />
          Sản phẩm
        </h2>

        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 p-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-control bg-sunken">
                {item.productImage ? (
                  <img
                    src={item.productImage}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                {/* Tên, giá và size/màu là bản chụp lúc mua, không đổi khi sản phẩm bị sửa. */}
                <p className="line-clamp-2 text-sm font-medium">{item.productName}</p>
                {item.size || item.color ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {[item.size, item.color].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                <p className="tabular mt-1 text-xs text-ink-muted">
                  {formatVnd(item.unitPrice)} × {item.quantity}
                </p>
              </div>

              <span className="tabular shrink-0 text-sm font-semibold">
                {formatVnd(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <PinIcon className="size-4 text-accent" />
            Giao tới
          </h2>
          <p className="text-sm font-medium">{order.receiverName}</p>
          <p className="tabular text-sm text-ink-muted">{order.receiverPhone}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {order.shippingLine1}, {order.shippingWard}, {order.shippingDistrict},{' '}
            {order.shippingProvince}
          </p>
          {order.note ? (
            <p className="mt-2 border-t border-line pt-2 text-sm">
              <span className="text-ink-muted">Ghi chú: </span>
              {order.note}
            </p>
          ) : null}
        </section>

        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <WalletIcon className="size-4 text-accent" />
            Thanh toán
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tạm tính</dt>
              <dd className="tabular">{formatVnd(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <TruckIcon className="size-4" />
                Phí vận chuyển
              </dt>
              <dd className="tabular">{formatVnd(order.shippingFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Hình thức</dt>
              <dd>{order.paymentMethod === 'COD' ? 'Khi nhận hàng' : 'MoMo'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tình trạng</dt>
              <dd>{order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="tabular text-accent">{formatVnd(order.total)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
