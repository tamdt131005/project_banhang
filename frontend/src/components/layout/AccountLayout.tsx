import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { PencilIcon, PinIcon, ReceiptIcon, UserIcon } from '../ui/icons';

export interface AccountLayoutProps {}

const ITEMS = [
  { label: 'Hồ sơ', to: '/tai-khoan', icon: <UserIcon /> },
  { label: 'Sổ địa chỉ', to: '/dia-chi', icon: <PinIcon /> },
  { label: 'Đơn mua', to: '/don-hang', icon: <ReceiptIcon /> },
];

/**
 * Khung chung cho khu tài khoản kiểu sàn TMĐT: sidebar avatar + điều hướng
 * bên trái trên desktop, thu thành hàng chip cuộn ngang trên di động.
 */
export function AccountLayout({}: Readonly<AccountLayoutProps>) {
  const { user } = useAuth();
  // ProtectedRoute đã chặn khách vãng lai; kiểm tra lại chỉ để TypeScript yên tâm.
  if (!user) return null;

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="mb-5 lg:mb-0">
        <div className="hidden rounded-card border border-line bg-surface p-3 lg:sticky lg:top-20 lg:block">
          <div className="flex items-center gap-3 p-2">
            <Avatar name={user.fullName} src={user.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.fullName}</p>
              <Link
                to="/tai-khoan"
                className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors duration-[160ms] hover:text-accent"
              >
                <PencilIcon className="size-3" />
                Sửa hồ sơ
              </Link>
            </div>
          </div>

          <hr className="my-2 border-line" />

          <nav aria-label="Tài khoản" className="space-y-0.5">
            {ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors duration-[160ms] ${
                    isActive
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-ink hover:bg-sunken'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Di động: sidebar nhường chỗ cho hàng chip — quen tay như bộ lọc đơn hàng. */}
        <nav aria-label="Tài khoản" className="no-scrollbar flex gap-2 overflow-x-auto lg:hidden">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors duration-[160ms] ${
                  isActive
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line hover:bg-sunken'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
