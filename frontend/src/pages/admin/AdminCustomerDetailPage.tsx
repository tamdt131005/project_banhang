import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import {
  ArrowLeftIcon,
  LogoutIcon,
  PinIcon,
  ReceiptIcon,
  ShieldIcon,
  UserIcon,
  WalletIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, formatVnd } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminCustomerDetailPageProps {}

export function AdminCustomerDetailPage({}: Readonly<AdminCustomerDetailPageProps>) {
  const { id = '' } = useParams<{ id: string }>();
  const userId = Number(id);
  const queryClient = useQueryClient();
  const { user: me, isAdmin: canManageAccess } = useAuth();

  const [confirming, setConfirming] = useState<'role' | 'revoke' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const user = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminGateway.users.detail(userId).then((response) => response.user),
    enabled: Number.isInteger(userId) && userId > 0,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  }

  const setRole = useMutation({
    mutationFn: (role: 'USER' | 'ADMIN') => adminGateway.users.setRole(userId, role),
    onSuccess: ({ user: updated }) => {
      refresh();
      setConfirming(null);
      setNotice(
        updated.role === 'ADMIN'
          ? 'Đã cấp quyền quản trị cho tài khoản này.'
          : 'Đã hạ về quyền khách hàng và thu hồi mọi phiên đăng nhập.',
      );
    },
  });

  const revoke = useMutation({
    mutationFn: () => adminGateway.users.revokeSessions(userId),
    onSuccess: ({ revoked }) => {
      setConfirming(null);
      setNotice(
        revoked > 0
          ? `Đã buộc đăng xuất ${revoked} phiên đăng nhập.`
          : 'Tài khoản này không có phiên đăng nhập nào đang hoạt động.',
      );
    },
  });

  if (user.isPending) return <Skeleton className="h-96" />;

  if (user.isError) {
    return (
      <div className="space-y-4">
        <Alert>{errorMessage(user.error)}</Alert>
        <Link
          to="/admin/khach-hang"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
        >
          <ArrowLeftIcon className="size-4" />
          Về danh sách khách hàng
        </Link>
      </div>
    );
  }

  const data = user.data;
  const isSelf = me?.id === data.id;
  const isAdmin = data.role === 'ADMIN';
  const isStaff = data.role === 'STAFF';

  return (
    <div className="space-y-4">
      <Link
        to="/admin/khach-hang"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-[160ms] hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách khách hàng
      </Link>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {setRole.isError ? <Alert>{errorMessage(setRole.error)}</Alert> : null}
      {revoke.isError ? <Alert>{errorMessage(revoke.error)}</Alert> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-3">
          <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Avatar name={data.fullName} src={data.avatarUrl} size="xl" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{data.fullName}</h1>
                <p className="truncate text-sm text-ink-muted">{data.email}</p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-[0.625rem] font-bold ${
                    data.role !== 'USER' ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-muted'
                  }`}
                >
                  {data.role !== 'USER' ? <ShieldIcon className="size-3" /> : <UserIcon className="size-3" />}
                  {isAdmin ? 'Quản trị viên' : isStaff ? 'Nhân viên' : 'Khách hàng'}
                </span>
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Số điện thoại</dt>
                <dd className="tabular">{data.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Ngày đăng ký</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Đơn đã đặt</dt>
                <dd className="tabular font-semibold">{data._count.orders}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-ink-muted">
                  <WalletIcon className="size-4" />
                  Đã chi tiêu
                </dt>
                <dd className="tabular font-semibold text-accent">
                  {formatVnd(data.stats.totalSpent)}
                </dd>
              </div>
            </dl>
            <p className="mt-1 text-xs text-ink-muted">
              Chỉ tính {data.stats.deliveredOrders} đơn đã giao thành công.
            </p>
          </section>

          <section className="space-y-2 rounded-card border border-line bg-surface p-4 sm:p-5">
            <h2 className="font-semibold">Quyền truy cập</h2>
            <p className="text-xs text-ink-muted">
              {isAdmin
                ? 'Quản trị viên có toàn quyền trên khu quản trị.'
                : isStaff
                  ? 'Nhân viên chỉ truy cập các mục được cấp riêng.'
                  : 'Tài khoản khách hàng chưa được cấp quyền quản trị.'}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {canManageAccess && !isAdmin ? (
                <Link
                  to={`/admin/phan-quyen?role=${isStaff ? 'STAFF' : 'USER'}&id=${data.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-xs font-medium text-ink transition hover:border-accent hover:text-accent"
                >
                  <ShieldIcon className="size-3.5" />
                  {isStaff ? 'Chỉnh quyền nhân viên' : 'Gắn quyền nhân viên'}
                </Link>
              ) : null}
              {canManageAccess && !isSelf ? (
                <Button
                  variant={isAdmin ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => setConfirming('role')}
                >
                  <ShieldIcon className="size-3.5" />
                  {isAdmin ? 'Hạ về quyền khách' : 'Cấp quyền quản trị cấp cao'}
                </Button>
              ) : null}
              {canManageAccess ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirming('revoke')}>
                  <LogoutIcon className="size-3.5" />
                  Buộc đăng xuất
                </Button>
              ) : null}
            </div>

            {isSelf ? (
              <p className="text-xs text-ink-muted">
                Đây là tài khoản bạn đang dùng nên không tự đổi quyền được.
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-3">
          <section className="rounded-card border border-line bg-surface">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-semibold sm:px-5">
              <ReceiptIcon className="size-4 text-accent" />
              Lịch sử mua hàng
            </h2>

            {data.orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                Khách này chưa đặt đơn nào.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {data.orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/admin/don-hang/${order.code}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-[160ms] hover:bg-sunken sm:px-5"
                    >
                      <span className="font-mono text-sm font-semibold">{order.code}</span>
                      <OrderStatusBadge status={order.status} />
                      <span className="ml-auto text-xs text-ink-muted">
                        {formatDateTime(order.createdAt)}
                      </span>
                      <span className="tabular text-sm font-semibold text-accent">
                        {formatVnd(order.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data._count.orders > data.orders.length ? (
              <p className="border-t border-line px-5 py-2 text-xs text-ink-muted">
                Hiển thị {data.orders.length} đơn gần nhất trên tổng {data._count.orders}.
              </p>
            ) : null}
          </section>

          <section className="rounded-card border border-line bg-surface">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-semibold sm:px-5">
              <PinIcon className="size-4 text-accent" />
              Sổ địa chỉ
            </h2>

            {data.addresses.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">Chưa lưu địa chỉ nào.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.addresses.map((address) => (
                  <li key={address.id} className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-medium">{address.fullName}</span>
                      <span className="tabular text-sm text-ink-muted">{address.phone}</span>
                      {address.isDefault ? (
                        <span className="rounded-control border border-accent px-1.5 py-0.5 text-[0.625rem] font-bold text-accent uppercase">
                          Mặc định
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {address.line1}, {address.ward}, {address.district}, {address.province}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'role'}
        danger={isAdmin}
        title={isAdmin ? 'Hạ về quyền khách hàng?' : 'Cấp quyền quản trị cấp cao?'}
        description={
          isAdmin
            ? `${data.fullName} sẽ mất quyền vào khu quản trị và bị đăng xuất khỏi mọi thiết bị.`
            : `${data.fullName} sẽ vào được toàn bộ khu quản trị, gồm cả sửa giá và tồn kho.`
        }
        confirmLabel={isAdmin ? 'Hạ quyền' : 'Cấp quyền'}
        loading={setRole.isPending}
        onConfirm={() => setRole.mutate(isAdmin ? 'USER' : 'ADMIN')}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === 'revoke'}
        title="Buộc đăng xuất tài khoản này?"
        description="Mọi thiết bị đang đăng nhập sẽ phải nhập lại mật khẩu. Dùng khi nghi ngờ tài khoản bị lộ."
        confirmLabel="Buộc đăng xuất"
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
