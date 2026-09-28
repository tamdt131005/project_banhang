import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type AddressInput, addressApi } from '../../api/addresses';
import { catalogApi } from '../../api/catalog';
import { orderApi } from '../../api/orders';
import { AddressForm } from '../../components/address/AddressForm';
import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/Field';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { BagIcon, PinIcon, PlusIcon, ReceiptIcon, TruckIcon, WalletIcon } from '../../components/ui/icons';
import { useCart } from '../../hooks/useCart';
import { readBuyNow } from '../../lib/buy-now';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { formatVnd } from '../../lib/format';

/** Khớp mức mặc định SHIPPING_FEE của backend khi giỏ đang trống nên không có phí để đọc. */
const DEFAULT_SHIPPING_FEE = 30_000;

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface CheckoutPageProps {}

export function CheckoutPage({}: Readonly<CheckoutPageProps>) {
  const navigate = useNavigate();
  const location = useLocation();
  const buyNow = readBuyNow(location.state);
  const queryClient = useQueryClient();
  const cart = useCart();

  const buyNowProduct = useQuery({
    queryKey: ['product', buyNow?.slug],
    queryFn: () => catalogApi.product(buyNow!.slug).then((response) => response.product),
    enabled: buyNow !== null,
  });

  const [addressId, setAddressId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((response) => response.addresses),
  });

  // Chọn sẵn địa chỉ mặc định để khách không phải bấm thêm một bước.
  useEffect(() => {
    if (addressId !== null || !addresses.data || addresses.data.length === 0) return;
    const preferred = addresses.data.find((item) => item.isDefault) ?? addresses.data[0];
    if (preferred) setAddressId(preferred.id);
  }, [addresses.data, addressId]);

  const createAddress = useMutation({
    mutationFn: (input: AddressInput) => addressApi.create(input),
    onSuccess: ({ address }) => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setAddressId(address.id);
      setAdding(false);
    },
  });

  const placeOrder = useMutation({
    mutationFn: () => {
      if (addressId === null) throw new Error('Vui lòng chọn địa chỉ giao hàng.');
      return orderApi.create({
        addressId,
        paymentMethod: 'COD',
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(buyNow ? { buyNow: { variantId: buyNow.variantId, quantity: buyNow.quantity } } : {}),
      });
    },
    onSuccess: ({ order }) => {
      // Thanh toán giỏ thì backend dọn giỏ; mua ngay thì giỏ giữ nguyên. Cả hai đều làm danh sách đơn cũ.
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void navigate(`/dat-hang-thanh-cong/${order.code}`, { replace: true });
    },
    onError: (error) => setFailure(errorMessage(error)),
  });

  if (addresses.isPending || (buyNow ? buyNowProduct.isPending : cart.isPending)) {
    return <Skeleton className="h-64" />;
  }

  if (buyNow && buyNowProduct.isError) return <Alert>{errorMessage(buyNowProduct.error)}</Alert>;
  if (!buyNow && cart.isError) return <Alert>{errorMessage(cart.error)}</Alert>;

  const buyNowVariant = buyNow
    ? (buyNowProduct.data?.variants.find((variant) => variant.id === buyNow.variantId) ?? null)
    : null;

  if (!buyNow && cart.data && cart.data.items.length === 0) {
    return (
      <Alert tone="info">
        Giỏ hàng đang trống.{' '}
        <Link to="/san-pham" className="font-semibold underline">
          Xem sản phẩm
        </Link>
      </Alert>
    );
  }

  const list = addresses.data ?? [];
  const showForm = adding || list.length === 0;
  const product = buyNowProduct.data;
  const buyNowReady = buyNow !== null && product !== undefined && buyNowVariant !== null;
  const lines = (() => {
    if (buyNow) {
      if (!product || !buyNowVariant) return [];
      return [
        {
          key: buyNow.variantId,
          slug: product.slug,
          name: product.name,
          thumbUrl: product.images[0]?.thumbUrl ?? null,
          size: buyNowVariant.size,
          color: buyNowVariant.color,
          unitPrice: product.price,
          quantity: buyNow.quantity,
          lineTotal: product.price * buyNow.quantity,
        },
      ];
    }

    return (cart.data?.items ?? []).map((item) => ({
      key: item.id,
      slug: item.slug,
      name: item.name,
      thumbUrl: item.thumbUrl,
      size: item.size,
      color: item.color,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }));
  })();
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingFee =
    buyNow
      ? cart.data && cart.data.shippingFee > 0
        ? cart.data.shippingFee
        : DEFAULT_SHIPPING_FEE
      : (cart.data?.shippingFee ?? 0);
  const outOfStock = Boolean(buyNow && buyNowVariant && buyNowVariant.stock < buyNow.quantity);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Thanh toán</h1>
      {buyNow ? (
        <p className="text-sm text-ink-muted">
          Mua ngay chỉ gồm sản phẩm vừa chọn. Giỏ hàng hiện tại được giữ nguyên.
        </p>
      ) : null}

      {failure ? <Alert>{failure}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <BagIcon className="size-4 text-accent" />
              Sản phẩm
            </h2>

            {buyNow && !buyNowReady ? (
              <Alert>Không tìm thấy lựa chọn size và màu này. Vui lòng chọn lại sản phẩm.</Alert>
            ) : null}
            {outOfStock ? <Alert>Số lượng vừa chọn không còn đủ hàng.</Alert> : null}

            <ul className="space-y-3">
              {lines.map((item) => (
                <li key={item.key} className="flex gap-3">
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
                    <Link to={`/san-pham/${item.slug}`} className="text-sm font-medium">
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {item.size} · {item.color}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="tabular text-ink">{formatVnd(item.unitPrice)}</span>
                      <span className="tabular"> × {item.quantity}</span>
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-semibold">{formatVnd(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <PinIcon className="size-4 text-accent" />
                Địa chỉ giao hàng
              </h2>
              {list.length > 0 && !adding ? (
                <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                  <PlusIcon className="size-3.5" />
                  Thêm địa chỉ mới
                </Button>
              ) : null}
            </div>

            {showForm ? (
              <AddressForm
                submitLabel="Dùng địa chỉ này"
                loading={createAddress.isPending}
                errorMessage={
                  createAddress.error ? errorMessage(createAddress.error) : undefined
                }
                fieldErrors={fieldErrors(createAddress.error)}
                onSubmit={(input) => createAddress.mutate(input)}
                {...(list.length > 0 ? { onCancel: () => setAdding(false) } : {})}
              />
            ) : (
              <ul className="space-y-2">
                {list.map((address) => (
                  <li key={address.id}>
                    <label className="flex cursor-pointer gap-3 rounded-control border border-line p-3 transition-colors duration-[160ms] hover:bg-sunken has-checked:border-accent has-checked:bg-accent-soft">
                      <input
                        type="radio"
                        name="address"
                        value={address.id}
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        className="mt-1 accent-accent"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{address.fullName}</span>
                        <span className="tabular ml-2 text-ink-muted">{address.phone}</span>
                        {address.isDefault ? (
                          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                            Mặc định
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-ink-muted">
                          {address.line1}, {address.ward}, {address.district}, {address.province}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <WalletIcon className="size-4 text-accent" />
              Phương thức thanh toán
            </h2>

            <div className="rounded-control border border-accent bg-accent-soft p-3 text-sm">
              <p className="font-medium text-accent">Thanh toán khi nhận hàng (COD)</p>
              <p className="mt-0.5 text-ink-muted">Trả tiền mặt cho nhân viên giao hàng.</p>
            </div>

            <p className="mt-2 text-xs text-ink-muted">
              Thanh toán MoMo chưa được đấu nối trong phiên bản này.
            </p>
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <TextAreaField
              label="Ghi chú cho người bán"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: giao trong giờ hành chính"
            />
          </section>
        </div>

        <aside className="h-fit rounded-card border border-line bg-surface p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ReceiptIcon className="size-4 text-accent" />
            Đơn hàng
          </h2>

          <ul className="mb-3 space-y-3 text-sm">
            {lines.map((item) => (
              <li key={item.key} className="flex gap-2">
                <span className="size-12 shrink-0 overflow-hidden rounded-control bg-sunken">
                  {item.thumbUrl ? (
                    <img src={item.thumbUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {item.size} · {item.color}
                    <span className="tabular"> × {item.quantity}</span>
                  </span>
                </span>
                <span className="tabular shrink-0">{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tạm tính</dt>
              <dd className="tabular">{formatVnd(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <TruckIcon className="size-4" />
                Phí vận chuyển
              </dt>
              <dd className="tabular">{formatVnd(shippingFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="tabular text-accent">{formatVnd(subtotal + shippingFee)}</dd>
            </div>
          </dl>

          <Button
            className="mt-4 w-full"
            loading={placeOrder.isPending}
            disabled={
              addressId === null ||
              (buyNow ? !buyNowReady || outOfStock : Boolean(cart.data?.hasUnavailableItems))
            }
            onClick={() => {
              setFailure(null);
              placeOrder.mutate();
            }}
          >
            Đặt hàng
          </Button>

          {addressId === null ? (
            <p className="mt-2 text-xs text-ink-muted">Chọn hoặc thêm địa chỉ để tiếp tục.</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
