import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type AddressInput, addressApi } from '../../api/addresses';
import { orderApi } from '../../api/orders';
import { AddressForm } from '../../components/address/AddressForm';
import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/Field';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { PinIcon, PlusIcon, ReceiptIcon, TruckIcon, WalletIcon } from '../../components/ui/icons';
import { useCart } from '../../hooks/useCart';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface CheckoutPageProps {}

export function CheckoutPage({}: Readonly<CheckoutPageProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();

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
      });
    },
    onSuccess: ({ order }) => {
      // Đặt hàng xong backend đã dọn giỏ, nên cache giỏ và danh sách đơn đều cũ.
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void navigate(`/dat-hang-thanh-cong/${order.code}`, { replace: true });
    },
    onError: (error) => setFailure(errorMessage(error)),
  });

  if (cart.isPending || addresses.isPending) {
    return <Skeleton className="h-64" />;
  }

  if (cart.isError) return <Alert>{errorMessage(cart.error)}</Alert>;

  if (cart.data.items.length === 0) {
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

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Thanh toán</h1>

      {failure ? <Alert>{failure}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
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

          <ul className="mb-3 space-y-2 text-sm">
            {cart.data.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="line-clamp-1 text-ink-muted">
                  {item.name} ({item.size}, {item.color}){' '}
                  <span className="tabular">×{item.quantity}</span>
                </span>
                <span className="tabular shrink-0">{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tạm tính</dt>
              <dd className="tabular">{formatVnd(cart.data.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <TruckIcon className="size-4" />
                Phí vận chuyển
              </dt>
              <dd className="tabular">{formatVnd(cart.data.shippingFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="tabular text-accent">{formatVnd(cart.data.total)}</dd>
            </div>
          </dl>

          <Button
            className="mt-4 w-full"
            loading={placeOrder.isPending}
            disabled={addressId === null || cart.data.hasUnavailableItems}
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
