import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { Pagination } from '../../components/ui/Pagination';
import { CheckIcon, SearchIcon, ShieldIcon, UserIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import type { AdminPermission } from '../../types/api';

const PERMISSION_OPTIONS: { key: AdminPermission; label: string; description: string }[] = [
  { key: 'DASHBOARD', label: 'Tổng quan', description: 'Xem doanh thu, đơn hàng và tình hình cửa hàng.' },
  { key: 'ORDERS', label: 'Đơn hàng', description: 'Xem, cập nhật trạng thái và thanh toán đơn.' },
  { key: 'INVENTORY', label: 'Kho hàng', description: 'Xem tồn kho, điều chỉnh số lượng và lịch sử.' },
  { key: 'CATALOG', label: 'Sản phẩm & danh mục', description: 'Quản lý sản phẩm, biến thể và danh mục.' },
  { key: 'BANNERS', label: 'Banner', description: 'Tạo, sửa và bật/tắt banner cửa hàng.' },
  { key: 'CUSTOMERS', label: 'Khách hàng', description: 'Xem hồ sơ, địa chỉ và lịch sử mua hàng.' },
  { key: 'SUPPORT', label: 'Hỗ trợ', description: 'Tiếp nhận và trả lời hội thoại khách hàng.' },
];

export interface AdminPermissionsPageProps {}

export function AdminPermissionsPage({}: Readonly<AdminPermissionsPageProps>) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? 1);
  const selectedId = Number(params.get('id') ?? 0);
  const [keyword, setKeyword] = useState(search);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState<AdminPermission[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => setKeyword(search), [search]);

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    if (!('page' in next)) merged.delete('page');
    setParams(merged);
  }

  const users = useQuery({
    queryKey: ['admin', 'users', 'access', { search, page }],
    queryFn: () =>
      adminGateway.users.list({
        role: 'STAFF',
        ...(search ? { search } : {}),
        page,
        limit: 20,
      }),
  });

  useEffect(() => {
    if (!users.data?.items.length) return;
    const visibleIds = users.data.items.map((item) => item.id);
    if (!visibleIds.includes(selectedId)) update({ id: String(visibleIds[0]) });
  }, [users.data, selectedId]);

  const selectedUser = users.data?.items.find((item) => item.id === selectedId);
  const access = useQuery({
    queryKey: ['admin', 'user-access', selectedId],
    queryFn: () => adminGateway.users.access(selectedId).then((response) => response.access),
    enabled: selectedUser !== undefined,
  });

  useEffect(() => {
    if (!access.data) return;
    setPermissions(access.data.permissions);
  }, [access.data]);

  const save = useMutation({
    mutationFn: () =>
      adminGateway.users.setAccess(selectedId, {
        permissions,
      }),
    onSuccess: async (response) => {
      setNotice('Đã lưu quyền nhân viên.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'user-access', selectedId] }),
      ]);
    },
  });

  const create = useMutation({
    mutationFn: () => adminGateway.users.createStaff({
      fullName: newFullName.trim(),
      email: newEmail.trim(),
      ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
      password: newPassword,
      permissions: newPermissions,
    }),
    onSuccess: async ({ user }) => {
      setShowCreate(false);
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setConfirmPassword('');
      setNewPermissions([]);
      setNotice(`Đã tạo tài khoản nhân viên ${user.fullName}. Hãy chuyển mật khẩu ban đầu cho họ qua kênh riêng.`);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      update({ search: undefined, id: String(user.id) });
    },
  });

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    if (newPassword !== confirmPassword) {
      setCreateError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    if (newPermissions.length === 0) {
      setCreateError('Hãy chọn ít nhất một quyền cho nhân viên.');
      return;
    }
    create.mutate();
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ search: keyword.trim(), id: undefined });
  }

  function togglePermission(permission: AdminPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  const isDirty = access.data
    ? permissions.slice().sort().join(',') !== access.data.permissions.slice().sort().join(',')
    : false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Nhân viên & phân quyền</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Chỉ chủ shop được tạo nhân viên và cấp đúng các mục họ cần dùng.
          </p>
        </div>
        <Button
          disabled={create.isPending}
          onClick={() => {
            if (showCreate) {
              setNewPassword('');
              setConfirmPassword('');
              setCreateError(null);
              create.reset();
            }
            setShowCreate((value) => !value);
          }}
        >
          {showCreate ? 'Đóng form' : 'Thêm nhân viên'}
        </Button>
      </div>

      {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {showCreate ? (
        <form onSubmit={submitCreate} className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-xs sm:p-5">
          <div>
            <h2 className="font-semibold">Tạo tài khoản nhân viên</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Nhân viên đăng nhập tại trang riêng rồi có thể đổi mật khẩu trong khu làm việc.
            </p>
          </div>
          {createError ? <Alert>{createError}</Alert> : null}
          {create.isError ? <Alert>{errorMessage(create.error)}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Họ và tên" required value={newFullName} onChange={(event) => setNewFullName(event.target.value)} />
            <TextField label="Email đăng nhập" type="email" required autoComplete="off" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
            <TextField label="Số điện thoại" inputMode="numeric" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
            <div />
            <TextField label="Mật khẩu ban đầu" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <TextField label="Nhập lại mật khẩu" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Quyền truy cập ban đầu</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMISSION_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-control border border-line p-3 hover:bg-sunken has-checked:border-accent has-checked:bg-accent-soft/40">
                  <input
                    type="checkbox"
                    checked={newPermissions.includes(option.key)}
                    onChange={() => setNewPermissions((current) =>
                      current.includes(option.key)
                        ? current.filter((item) => item !== option.key)
                        : [...current, option.key])}
                    className="mt-0.5 size-4 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" loading={create.isPending}>Tạo nhân viên</Button>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.15fr)]">
        <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-xs">
          <div className="space-y-3 border-b border-line p-4">
            <h2 className="font-semibold">Danh sách nhân viên</h2>
            <form onSubmit={submitSearch} className="relative">
              <label htmlFor="staff-search" className="sr-only">Tìm tài khoản</label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="staff-search"
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm theo tên hoặc email…"
                className="h-9 w-full rounded-control border border-line bg-sunken pr-3 pl-9 text-sm outline-none focus:border-accent"
              />
            </form>
          </div>

          {users.isPending ? (
            <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : users.isError ? (
            <div className="p-4"><Alert>{errorMessage(users.error)}</Alert></div>
          ) : users.data.items.length === 0 ? (
            <EmptyState
              title={search ? 'Không tìm thấy nhân viên' : 'Chưa có nhân viên nào'}
              description={search ? 'Thử từ khoá khác.' : 'Chủ shop có thể tạo nhân viên bằng nút phía trên.'}
              icon={<UserIcon className="size-6" />}
            />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {users.data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        update({ id: String(item.id) });
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/60 ${
                        selectedId === item.id ? 'bg-accent-soft/60' : ''
                      }`}
                    >
                      <Avatar name={item.fullName} src={item.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.fullName}</span>
                        <span className="block truncate text-xs text-ink-muted">{item.email}</span>
                      </span>
                      <span className="rounded-control bg-accent-soft px-2 py-1 text-[0.65rem] font-semibold text-accent">Nhân viên</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-3">
                <Pagination
                  page={users.data.pagination.page}
                  totalPages={users.data.pagination.totalPages}
                  onChange={(next) => update({ page: String(next), id: undefined })}
                />
              </div>
            </>
          )}
        </section>

        <section className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-xs sm:p-5">
          {!selectedUser ? (
            <EmptyState title="Chọn nhân viên" description="Chọn một tài khoản nhân viên để chỉnh quyền." icon={<UserIcon className="size-6" />} />
          ) : access.isPending ? (
            <Skeleton className="h-96" />
          ) : access.isError ? (
            <Alert>{errorMessage(access.error)}</Alert>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar name={selectedUser.fullName} src={selectedUser.avatarUrl} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{selectedUser.fullName}</h2>
                  <p className="truncate text-sm text-ink-muted">{selectedUser.email}</p>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Các mục được phép truy cập</legend>
                {PERMISSION_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3 rounded-control border border-line p-3 transition-colors hover:bg-sunken has-checked:border-accent has-checked:bg-accent-soft/40"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(option.key)}
                      onChange={() => togglePermission(option.key)}
                      className="mt-0.5 size-4 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{option.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {permissions.length === 0 ? (
                <Alert tone="info">Nhân viên cần ít nhất một quyền.</Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-ink-muted">
                  {permissions.length} mục được chọn
                </p>
                <Button
                  disabled={!isDirty || permissions.length === 0}
                  loading={save.isPending}
                  onClick={() => {
                    setNotice(null);
                    save.mutate();
                  }}
                >
                  <CheckIcon className="size-3.5" />
                  Lưu quyền
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <ShieldIcon className="size-3.5" />
                Thay đổi quyền sẽ buộc tài khoản đăng nhập lại.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
