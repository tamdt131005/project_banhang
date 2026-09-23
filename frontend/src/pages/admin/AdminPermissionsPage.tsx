import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
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
  const roleTab = params.get('role') === 'STAFF' ? 'STAFF' : 'USER';
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? 1);
  const selectedId = Number(params.get('id') ?? 0);
  const [keyword, setKeyword] = useState(search);
  const [enabled, setEnabled] = useState(false);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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
    queryKey: ['admin', 'users', 'access', { role: roleTab, search, page }],
    queryFn: () =>
      adminGateway.users.list({
        role: roleTab,
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
    enabled: Number.isSafeInteger(selectedId) && selectedId > 0,
  });

  useEffect(() => {
    if (!access.data) return;
    setEnabled(access.data.role === 'STAFF');
    setPermissions(access.data.permissions);
    setNotice(null);
  }, [access.data]);

  const save = useMutation({
    mutationFn: () =>
      adminGateway.users.setAccess(selectedId, {
        role: enabled ? 'STAFF' : 'USER',
        permissions: enabled ? permissions : [],
      }),
    onSuccess: async (response) => {
      setNotice(response.access.role === 'STAFF' ? 'Đã lưu quyền nhân viên.' : 'Đã thu hồi quyền nhân viên.');
      update({ role: response.access.role, id: String(selectedId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'user-access', selectedId] }),
      ]);
    },
  });

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
    ? enabled !== (access.data.role === 'STAFF') ||
      permissions.slice().sort().join(',') !== access.data.permissions.slice().sort().join(',')
    : false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Nhân viên & phân quyền</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Chọn một tài khoản, sau đó bật đúng các mục họ cần dùng. Quyền được áp dụng ngay sau khi lưu.
        </p>
      </div>

      {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.15fr)]">
        <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-xs">
          <div className="space-y-3 border-b border-line p-4">
            <h2 className="font-semibold">Chọn tài khoản</h2>
            <div className="flex gap-1 rounded-control bg-sunken p-1">
              {[
                { role: 'USER', label: 'Khách hàng' },
                { role: 'STAFF', label: 'Nhân viên' },
              ].map((tab) => (
                <button
                  key={tab.role}
                  type="button"
                  onClick={() => update({ role: tab.role, id: undefined })}
                  className={`flex-1 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                    roleTab === tab.role
                      ? 'bg-surface text-accent shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
              title={roleTab === 'STAFF' ? 'Chưa có nhân viên nào' : 'Không tìm thấy tài khoản'}
              description={roleTab === 'STAFF' ? 'Chọn một khách hàng để cấp quyền nhân viên.' : 'Thử từ khoá khác.'}
              icon={<UserIcon className="size-6" />}
            />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {users.data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => update({ id: String(item.id) })}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/60 ${
                        selectedId === item.id ? 'bg-accent-soft/60' : ''
                      }`}
                    >
                      <Avatar name={item.fullName} src={item.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.fullName}</span>
                        <span className="block truncate text-xs text-ink-muted">{item.email}</span>
                      </span>
                      {item.role === 'STAFF' ? (
                        <span className="rounded-control bg-accent-soft px-2 py-1 text-[0.65rem] font-semibold text-accent">Nhân viên</span>
                      ) : null}
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
          {!selectedUser || access.isPending ? (
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

              <div className="flex items-start gap-3 rounded-control border border-line bg-sunken/50 p-3">
                <input
                  id="staff-enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                <label htmlFor="staff-enabled" className="cursor-pointer">
                  <span className="block text-sm font-semibold">Cho phép truy cập khu quản trị</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    Tắt quyền này sẽ đưa tài khoản về khách hàng và thu hồi các quyền đang chọn.
                  </span>
                </label>
              </div>

              <fieldset disabled={!enabled} className="space-y-2 disabled:opacity-50">
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

              {enabled && permissions.length === 0 ? (
                <Alert tone="info">Hãy chọn ít nhất một mục hoặc tắt quyền nhân viên.</Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-ink-muted">
                  {enabled ? `${permissions.length} mục được chọn` : 'Tài khoản chưa có quyền quản trị'}
                </p>
                <Button
                  disabled={!isDirty || (enabled && permissions.length === 0)}
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
