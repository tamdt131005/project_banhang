import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminGateway } from '../../api/admin';
import { Avatar } from '../../components/ui/Avatar';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { ChevronRightIcon, SearchIcon, ShieldIcon, UserIcon } from '../../components/ui/icons';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminCustomersPageProps {}

const SORTS = [
  { value: 'newest', label: 'Mới đăng ký trước' },
  { value: 'orders-desc', label: 'Mua nhiều nhất' },
  { value: 'name', label: 'Tên A-Z' },
] as const;

export function AdminCustomersPage({}: Readonly<AdminCustomersPageProps>) {
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const role = params.get('role') ?? '';
  const sort = (params.get('sort') ?? 'newest') as (typeof SORTS)[number]['value'];
  const page = Number(params.get('page') ?? 1);

  const [keyword, setKeyword] = useState(search);
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
    queryKey: ['admin', 'users', { search, role, sort, page }],
    queryFn: () =>
      adminGateway.users.list({
        ...(search ? { search } : {}),
        ...(role ? { role: role as 'USER' | 'ADMIN' } : {}),
        sort,
        page,
        limit: 20,
      }),
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ search: keyword.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Khách hàng</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Danh sách tài khoản đã đăng ký, số đơn đã đặt và quyền truy cập.
          </p>
        </div>
        {users.data ? (
          <p className="text-sm text-ink-muted">
            <span className="tabular font-semibold text-ink">{users.data.pagination.total}</span> tài
            khoản
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-56 flex-1">
          <label htmlFor="customer-search" className="sr-only">
            Tìm khách hàng
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="customer-search"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên, email hoặc số điện thoại…"
            className="h-9 w-full rounded-control border border-line bg-sunken pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </form>

        <div className="flex gap-1.5">
          {[
            { value: '', label: 'Tất cả' },
            { value: 'USER', label: 'Khách' },
            { value: 'ADMIN', label: 'Quản trị' },
          ].map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              onClick={() => update({ role: option.value || undefined })}
              className={`h-9 shrink-0 rounded-control border px-3 text-xs font-medium transition-colors duration-[160ms] ${
                role === option.value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line hover:bg-sunken'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-ink-muted">Sắp xếp</span>
          <select
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            className="h-9 rounded-control border border-line bg-sunken px-2 text-sm outline-none focus:border-accent"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {users.isPending ? (
        <Skeleton className="h-72" />
      ) : users.isError ? (
        <Alert>{errorMessage(users.error)}</Alert>
      ) : users.data.items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản nào"
          description="Thử bỏ bộ lọc hoặc tìm bằng từ khoá khác."
          icon={<UserIcon className="size-6" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-xs">
            <table className="w-full min-w-[50rem] text-left">
              <thead className="border-b border-line bg-sunken/60 text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Tài khoản</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[0.6875rem]">Liên hệ</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Đơn hàng</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Địa chỉ</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Ngày đăng ký</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[0.6875rem]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-sunken/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <span className="line-clamp-1">{user.fullName}</span>
                            {user.role === 'ADMIN' ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-control bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold text-accent">
                                <ShieldIcon className="size-3" />
                                Quản trị
                              </span>
                            ) : null}
                          </p>
                          <p className="line-clamp-1 text-xs text-ink-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular px-4 py-3.5 text-sm text-ink-muted">{user.phone ?? '—'}</td>
                    <td className="tabular px-4 py-3.5 text-right text-sm font-bold text-ink">
                      {user._count.orders}
                    </td>
                    <td className="tabular px-4 py-3.5 text-right text-sm text-ink-muted">
                      {user._count.addresses}
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs whitespace-nowrap text-ink-muted">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/khach-hang/${user.id}`}
                        className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent hover:text-accent shadow-2xs"
                      >
                        <span>Chi tiết</span>
                        <ChevronRightIcon className="size-3 text-ink-muted" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={users.data.pagination.page}
            totalPages={users.data.pagination.totalPages}
            onChange={(next) => update({ page: String(next) })}
          />
        </>
      )}
    </div>
  );
}
